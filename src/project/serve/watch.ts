/*
 * watch.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, globToRegExp, join, relative, SEP } from "path/mod.ts";
import { existsSync, walkSync } from "fs/mod.ts";

import * as ld from "../../core/lodash.ts";

import {
  kSkipHidden,
  normalizePath,
  pathWithForwardSlashes,
} from "../../core/path.ts";
import { md5Hash } from "../../core/hash.ts";

import { logError } from "../../core/log.ts";
import { isRevealjsOutput } from "../../config/format.ts";

import {
  kProjectLibDir,
  kProjectWatchInputs,
  ProjectContext,
} from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { projectContext } from "../../project/project-context.ts";

import { ProjectWatcher, ServeOptions } from "./types.ts";
import { httpDevServer } from "../../core/http-devserver.ts";
import { RenderFlags } from "../../command/render/types.ts";
import { renderProject } from "../../command/render/project.ts";
import { render } from "../../command/render/render-shared.ts";
import { renderServices } from "../../command/render/render-services.ts";

import { isRStudio } from "../../core/platform.ts";
import { inputTargetIndexForOutputFile } from "../../project/project-index.ts";
import { engineIgnoreDirs } from "../../execute/engine.ts";
import { asArray } from "../../core/array.ts";
import { isPdfContent } from "../../core/mime.ts";
import { ServeRenderManager } from "./render.ts";

interface WatchChanges {
  config: boolean;
  output: boolean;
  reloadTarget?: string;
}

export function watchProject(
  project: ProjectContext,
  extensionDirs: string[],
  resourceFiles: string[],
  flags: RenderFlags,
  pandocArgs: string[],
  options: ServeOptions,
  renderingOnReload: boolean,
  renderManager: ServeRenderManager,
  stopServer: VoidFunction,
): Promise<ProjectWatcher> {
  // helper to refresh project config
  const refreshProjectConfig = async () => {
    project = (await projectContext(project.dir, flags, false))!;
  };

  // proj dir
  const projDir = normalizePath(project.dir);
  const projDirHidden = projDir + "/.";

  // output dir
  const outputDir = projectOutputDir(project);

  // lib dir
  const libDirConfig = project.config?.project[kProjectLibDir];
  const libDirSource = libDirConfig
    ? join(project.dir, libDirConfig)
    : undefined;

  // is this a resource file?
  const isResourceFile = (path: string) => {
    // exclude libdir
    if (libDirSource && path.startsWith(libDirSource)) {
      return false;
    } else {
      // check project resources and resources derived from
      // indvidual files
      return project.files.resources?.includes(path) ||
        resourceFiles.includes(path);
    }
  };

  // is this an extension file
  const isExtensionFile = (path: string) => {
    return extensionDirs.some((extensionDir) => path.startsWith(extensionDir));
  };

  // is this an input file?
  const isInputFile = (path: string) => {
    return project.files.input.includes(path);
  };

  // track rendered inputs and outputs so we don't double render if the file notifications are chatty
  const rendered = new Map<string, string>();

  // handle a watch event (return true if a reload should occur)
  const handleWatchEvent = async (
    event: Deno.FsEvent,
  ): Promise<WatchChanges | undefined> => {
    try {
      const paths = ld.uniq(
        event.paths
          // filter out paths in hidden folders (e.g. .quarto, .git, .Rproj.user)
          .filter((path) => !path.startsWith(projDirHidden))
          // filter out the output dir if its distinct from the project dir
          .filter((path) =>
            outputDir === project.dir || !path.startsWith(outputDir)
          ),
      );

      // return if there are no paths
      if (paths.length === 0) {
        return;
      }

      if (["modify", "create"].includes(event.kind)) {
        // render changed input files (if we are watching). then
        // arrange for client reload
        if (options[kProjectWatchInputs]) {
          // get inputs (filter by whether the last time we rendered
          // this input had the exact same content hash)
          const inputs = paths.filter(isInputFile).filter(existsSync).filter(
            (input) => {
              return !rendered.has(input) ||
                rendered.get(input) !== md5Hash(Deno.readTextFileSync(input));
            },
          );
          if (inputs.length) {
            // render
            const services = renderServices();
            try {
              const result = await renderManager.renderQueue().enqueue(() => {
                if (inputs.length > 1) {
                  return renderProject(
                    project!,
                    {
                      services,
                      progress: true,
                      flags,
                      pandocArgs,
                      previewServer: true,
                    },
                    inputs,
                  );
                } else {
                  return render(inputs[0], {
                    services,
                    flags,
                    pandocArgs: pandocArgs,
                    previewServer: true,
                  });
                }
              });

              if (result.error) {
                if (result.error.message) {
                  logError(result.error);
                }
                return undefined;
              } else {
                // record rendered hash
                for (const input of inputs.filter(existsSync)) {
                  rendered.set(input, md5Hash(Deno.readTextFileSync(input)));
                }
                renderManager.onRenderResult(
                  result,
                  extensionDirs,
                  resourceFiles,
                  project!,
                );

                // Filter out supplmental files (e.g. files that were injected as supplements)
                // to the render. Instead, we should return the first non-supplemental file.
                // Example of supplemental file is a user rendering a post that appears in a listing
                // - the listing will be added as a supplement since changes in the post may change the
                // listing itself
                const nonSupplementalFiles = result.files.filter(
                  (renderResultFile) => {
                    return !renderResultFile.supplemental;
                  },
                );

                return {
                  config: false,
                  output: true,
                  reloadTarget: (nonSupplementalFiles.length &&
                      !isPdfContent(nonSupplementalFiles[0].file))
                    ? join(outputDir, nonSupplementalFiles[0].file)
                    : undefined,
                };
              }
            } finally {
              services.cleanup();
            }
          }
        }

        const configFile = paths.some((path) =>
          (project.files.config || []).includes(path)
        );
        const inputFileRemoved = project.files.input.some((file) =>
          !existsSync(file)
        );
        const configResourceFile = paths.some((path) =>
          (project.files.configResources || []).includes(path)
        );
        const resourceFile = paths.some(isResourceFile);
        const extensionFile = paths.some(isExtensionFile);

        const reload = configFile || configResourceFile ||
          resourceFile || extensionFile ||
          inputFileRemoved;

        if (reload) {
          return {
            config: configFile || configResourceFile || inputFileRemoved,
            output: false,
          };
        } else {
          return;
        }
      } else {
        return;
      }
    } catch (e) {
      logError(e);
      return;
    }
  };

  // http devserver
  const devServer = httpDevServer(
    options.port!,
    options.timeout!,
    () => renderManager.renderQueue().isRunning(),
    stopServer,
  );

  // debounced function for notifying all clients of a change
  // (ensures that we wait for bulk file copying to complete
  // before triggering the reload)
  const reloadClients = ld.debounce(async (changes: WatchChanges) => {
    const services = renderServices();
    try {
      // fully render project if we aren't aleady rendering on reload (e.g. for pdf)
      if (!changes.output && !renderingOnReload) {
        await refreshProjectConfig();
        const result = await renderManager.renderQueue().enqueue(() =>
          renderProject(
            project,
            {
              services,
              useFreezer: true,
              devServerReload: true,
              flags,
              pandocArgs,
              previewServer: true,
            },
          )
        );
        if (result.error) {
          logError(result.error);
        } else {
          renderManager.onRenderResult(
            result,
            extensionDirs,
            resourceFiles,
            project,
          );
        }
      }

      // refresh config if necess
      if (changes.config) {
        await refreshProjectConfig();
      }

      // if this is a reveal presentation running inside rstudio then bail
      // because rstudio is handling preview separately
      let reloadTarget = changes.reloadTarget || "";
      if (reloadTarget && await preventReload(project, reloadTarget, options)) {
        return;
      }

      // verify that its okay to reload this file
      if (reloadTarget && options.navigate) {
        if (reloadTarget.startsWith(outputDir)) {
          reloadTarget = relative(outputDir, reloadTarget);
        } else {
          reloadTarget = relative(projDir, reloadTarget);
        }
        if (existsSync(join(outputDir, reloadTarget))) {
          reloadTarget = "/" + pathWithForwardSlashes(reloadTarget);
        } else {
          reloadTarget = "";
        }
      } else {
        reloadTarget = "";
      }

      // reload clients
      devServer.reloadClients(reloadTarget);
    } catch (e) {
      logError(e);
    } finally {
      services.cleanup();
    }
  }, 100);

  // initalize watchers
  const runWatcher = (watcherOptions: WatcherOptions) => {
    const watchPaths = asArray(watcherOptions.paths);
    const watcher = Deno.watchFs(watchPaths, watcherOptions.options);
    const watchForChanges = async () => {
      for await (const event of watcher) {
        try {
          // if a new directory within a non-recursive watch is created then watch it recursively
          // (note that the top-level directory is watched non-recursively so that we don't pick
          // up hidden dirs, venv/renv dirs, etc.)
          if (event.kind === "create" && !watcherOptions.options?.recursive) {
            event.paths.forEach((path) => {
              if (existsSync(path)) {
                try {
                  const stat = Deno.statSync(path);
                  if (stat.isDirectory) {
                    if (watchPaths.some((p) => p === dirname(path))) {
                      runWatcher({ paths: path, options: { recursive: true } });
                    }
                  }
                } catch (e) {
                  // existing symlinks to nonexisting files cause path
                  // to exist and statSync to fail
                  if (e instanceof Deno.errors.NotFound) {
                    return;
                  }
                  throw e;
                }
              }
            });
          }

          // see if we need to handle this
          const result = await handleWatchEvent(event);
          if (result) {
            await reloadClients(result);
          }
        } catch (e) {
          logError(e);
        }
      }
    };
    watchForChanges();
  };
  computeWatchers(project).forEach(runWatcher);

  // return watcher interface
  return Promise.resolve({
    handle: (req: Request) => {
      return devServer.handle(req);
    },
    connect: devServer.connect,
    injectClient: (req: Request, file: Uint8Array, inputFile?: string) => {
      return devServer.injectClient(req, file, inputFile);
    },
    clientHtml: (req: Request, inputFile?: string) => {
      return devServer.clientHtml(req, inputFile);
    },
    hasClients: () => devServer.hasClients(),
    reloadClients: async (output: boolean, reloadTarget?: string) => {
      await reloadClients({
        config: false,
        output,
        reloadTarget,
      });
    },
    project: () => project,
    refreshProject: async () => {
      await refreshProjectConfig();
      return project;
    },
  });
}

interface WatcherOptions {
  paths: string | string[];
  options?: { recursive: boolean };
}

function computeWatchers(project: ProjectContext): Array<WatcherOptions> {
  // enumerate top-level directories that aren't automatically ignored
  const projectDirs: string[] = [];
  for (
    const walk of walkSync(
      project.dir,
      {
        includeDirs: true,
        includeFiles: false,
        maxDepth: 1,
        followSymlinks: false,
        skip: [kSkipHidden].concat(
          engineIgnoreDirs().map((ignore: string) =>
            globToRegExp(join(project.dir, ignore) + SEP)
          ),
        ),
      },
    )
  ) {
    if (walk.path !== project.dir) {
      projectDirs.push(walk.path);
    }
  }

  // how many are there? if there are < 30 then we'll watch each one (thus sparing
  // the system from having to recursively watch a bunch of hidden or venv
  // directories). if there are > 30 we could run afowl of system file watch
  // limits so we use just one watch at the root level
  if (projectDirs.length <= 30) {
    return [{
      paths: project.dir,
      options: { recursive: false },
    }, {
      paths: projectDirs,
      options: { recursive: true },
    }];
  } else {
    return [{
      paths: project.dir,
      options: { recursive: true },
    }];
  }
}

async function preventReload(
  project: ProjectContext,
  lastHtmlFile: string,
  options: ServeOptions,
) {
  // if we are in rstudio with watchInputs off then we are using rstudio tooling
  // for the site preview -- in this case presentations are going to be handled
  // separately by the presentation pane
  if (isRStudio() && !options[kProjectWatchInputs]) {
    const index = await inputTargetIndexForOutputFile(
      project,
      relative(projectOutputDir(project), lastHtmlFile),
    );
    if (index) {
      return isRevealjsOutput(Object.keys(index.formats)[0]);
    }
  }

  return false;
}
