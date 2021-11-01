/*
* watch.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ServerRequest } from "http/server.ts";

import { extname, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { ld } from "lodash/mod.ts";

import { pathWithForwardSlashes, removeIfExists } from "../../core/path.ts";

import { logError } from "../../core/log.ts";
import { kProjectLibDir, ProjectContext } from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { projectContext } from "../../project/project-context.ts";

import {
  inputFileForOutputFile,
  resolveInputTarget,
} from "../../project/project-index.ts";

import { fileExecutionEngine } from "../../execute/engine.ts";

import { copyProjectForServe } from "./serve-shared.ts";

import { ProjectWatcher, ServeOptions } from "./types.ts";
import { httpReloader } from "../../core/http-reload.ts";
import { Format } from "../../config/types.ts";
import { RenderFlags } from "../render/types.ts";

export async function watchProject(
  project: ProjectContext,
  serveProject: ProjectContext,
  resourceFiles: string[],
  flags: RenderFlags,
  options: ServeOptions,
): Promise<ProjectWatcher> {
  // track renderOnChange inputs
  const renderOnChangeInputs: string[] = [];
  const updateRenderOnChangeInputs = async () => {
    // track render on change inputs
    renderOnChangeInputs.splice(0, renderOnChangeInputs.length);
    for (const inputFile of project.files.input) {
      const engine = fileExecutionEngine(inputFile);
      if (engine?.devServerRenderOnChange) {
        if (await engine.devServerRenderOnChange(inputFile, project)) {
          renderOnChangeInputs.push(inputFile);
        }
      }
    }
  };
  await updateRenderOnChangeInputs();

  // helper to refresh project config
  const refreshProjectConfig = async () => {
    // get project and temporary serve project
    project = (await projectContext(project.dir, flags, false, true))!;
    serveProject =
      (await projectContext(serveProject.dir, flags, false, true))!;
    await updateRenderOnChangeInputs();
  };

  // proj dir
  const projDir = Deno.realPathSync(project.dir);
  const projDirHidden = projDir + "/.";

  // output dir
  const outputDir = projectOutputDir(project);

  // lib dir
  const libDirConfig = project.config?.project[kProjectLibDir];
  const libDirSource = libDirConfig
    ? join(project.dir, libDirConfig)
    : undefined;
  const libDir = libDirConfig ? join(outputDir, libDirConfig) : undefined;

  // if any of the paths are in the output dir (but not the lib dir) then return true
  const inOutputDir = (path: string) => {
    if (path.startsWith(outputDir)) {
      // exclude lib dir
      if (libDir && path.startsWith(libDir)) {
        return false;
      } else {
        return true;
      }
    } else {
      return false;
    }
  };

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

  // is this a renderOnChange input file?
  const isRenderOnChangeInput = (path: string) => {
    return renderOnChangeInputs.includes(path) && existsSync(path);
  };

  // track every path that has been modified since the last reload
  const modified: string[] = [];

  // handle a watch event (return true if a reload should occur)
  const handleWatchEvent = (event: Deno.FsEvent): boolean | "config" => {
    try {
      // filter out paths in hidden folders (e.g. .quarto, .git, .Rproj.user)
      const paths = ld.uniq(
        event.paths.filter((path) => !path.startsWith(projDirHidden)),
      );
      if (paths.length === 0) {
        return false;
      }

      if (["modify", "create"].includes(event.kind)) {
        // note modified
        modified.push(...paths);

        const configFile = paths.some((path) =>
          (project.files.config || []).includes(path)
        );
        const configResourceFile = paths.some((path) =>
          (project.files.configResources || []).includes(path)
        );
        const resourceFile = paths.some(isResourceFile);

        const outputDirFile = paths.some(inOutputDir);

        const renderOnChangeInput = paths.some(isRenderOnChangeInput);

        const inputFileRemoved = project.files.input.some((file) =>
          !existsSync(file)
        );

        const reload = configFile || configResourceFile || resourceFile ||
          outputDirFile || renderOnChangeInput || inputFileRemoved;

        if (reload) {
          if (configFile || inputFileRemoved) {
            return "config";
          } else {
            return true;
          }
        } else {
          return false;
        }
      } else {
        return false;
      }
    } catch (e) {
      logError(e);
      return false;
    }
  };

  // http reloader
  const reloader = httpReloader(options.port);

  // debounced function for notifying all clients of a change
  // (ensures that we wait for bulk file copying to complete
  // before triggering the reload)
  let lastRenderOnChangeInput: string | undefined;
  const reloadClients = ld.debounce(async (refreshProject: boolean) => {
    try {
      // copy the project (refresh if requested)
      if (refreshProject) {
        // remove input files
        serveProject.files.input.forEach(removeIfExists);
      }
      copyProjectForServe(project, false, serveProject.dir);
      if (refreshProject) {
        await refreshProjectConfig();
      }

      // see if there is a reload target (last html file modified)
      const lastHtmlFile = ld.uniq(modified).reverse().find((file) => {
        return extname(file) === ".html";
      });

      // don't reload based on changes to html files generated from the last
      // reloadOnChange refresh (as we've already reloaded)
      if (lastHtmlFile) {
        const outputDir = projectOutputDir(project);
        const filePathRelative = relative(outputDir, lastHtmlFile);
        const inputFile = await inputFileForOutputFile(
          project,
          filePathRelative,
        );
        if (inputFile && (inputFile === lastRenderOnChangeInput)) {
          // clear out modified list
          lastRenderOnChangeInput = undefined;
          modified.splice(0, modified.length);
          // return (nothing more to do)
          return;
        }
      }

      let reloadTarget = "";
      if (lastHtmlFile && options.navigate) {
        if (lastHtmlFile.startsWith(outputDir)) {
          reloadTarget = relative(outputDir, lastHtmlFile);
        } else {
          reloadTarget = relative(projDir, lastHtmlFile);
        }
        if (existsSync(join(outputDir, reloadTarget))) {
          reloadTarget = "/" + pathWithForwardSlashes(reloadTarget);
        } else {
          reloadTarget = "";
        }
      }
      // if we don't have a reload target based on html output, see if we can
      // get one from a reloadOnChange input
      if (!reloadTarget) {
        const input = modified.find(isRenderOnChangeInput);
        if (input) {
          lastRenderOnChangeInput = input;
          const target = await resolveInputTarget(
            project,
            relative(project.dir, input),
          );
          if (target) {
            reloadTarget = target.outputHref;
          }
        }
      }

      // clear out the modified list
      modified.splice(0, modified.length);

      // reload clients
      reloader.reloadClients(reloadTarget);
    } catch (e) {
      logError(e);
    }
  }, 100);

  // watch project dir recursively
  const watcher = Deno.watchFs(project.dir, { recursive: true });
  const watchForChanges = async () => {
    for await (const event of watcher) {
      try {
        // see if we need to handle this
        const result = handleWatchEvent(event);
        if (result) {
          await reloadClients(result === "config");
        }
      } catch (e) {
        logError(e);
      } finally {
        watchForChanges();
      }
    }
  };
  watchForChanges();

  // return watcher interface
  return {
    handle: (req: ServerRequest) => {
      return !!options.watch && reloader.handle(req);
    },
    connect: reloader.connect,
    injectClient: (file: Uint8Array, inputFile?: string, format?: Format) => {
      if (options.watch) {
        return reloader.injectClient(file, inputFile, format);
      } else {
        return file;
      }
    },
    serveProject: () => serveProject,
    refreshProject: async () => {
      await refreshProjectConfig();
      return serveProject;
    },
  };
}
