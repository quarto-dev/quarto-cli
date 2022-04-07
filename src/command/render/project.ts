/*
* project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureDirSync, existsSync } from "fs/mod.ts";
import { copySync } from "fs/copy.ts";
import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import { info, warning } from "log/mod.ts";

import * as colors from "fmt/colors.ts";

import * as ld from "../../core/lodash.ts";

import { kKeepMd } from "../../config/constants.ts";

import {
  kProjectExecuteDir,
  kProjectLibDir,
  kProjectOutputDir,
  kProjectPostRender,
  kProjectPreRender,
  kProjectType,
  ProjectContext,
} from "../../project/types.ts";

import { projectType } from "../../project/types/project-types.ts";
import { copyResourceFile } from "../../project/project-resources.ts";
import { ensureGitignore } from "../../project/project-gitignore.ts";
import { partitionedMarkdownForInput } from "../../project/project-config.ts";

import { renderFiles } from "./render.ts";
import {
  RenderedFile,
  RenderFile,
  RenderOptions,
  RenderResult,
} from "./types.ts";
import {
  copyToProjectFreezer,
  kProjectFreezeDir,
  pruneProjectFreezer,
  pruneProjectFreezerDir,
} from "./freeze.ts";
import { resourceFilesFromRenderedFile } from "./render-shared.ts";
import { inputFilesDir } from "../../core/render.ts";
import {
  copyMinimal,
  removeIfEmptyDir,
  removeIfExists,
} from "../../core/path.ts";
import { handlerForScript } from "../../core/run/run.ts";
import { execProcess } from "../../core/process.ts";
import { parseShellRunCommand } from "../../core/run/shell.ts";

export async function renderProject(
  context: ProjectContext,
  options: RenderOptions,
  files?: string[],
): Promise<RenderResult> {
  // lookup the project type
  const projType = projectType(context.config?.project?.[kProjectType]);

  // get real path to the project
  const projDir = Deno.realPathSync(context.dir);

  // is this an incremental render?
  const incremental = !!files;

  // force execution for any incremental files (unless options.useFreezer is set)
  let alwaysExecuteFiles = incremental && !options.useFreezer
    ? ld.cloneDeep(files) as string[]
    : undefined;

  // file normaliation
  const normalizeFiles = (targetFiles: string[]) => {
    return targetFiles.map((file) => {
      const target = isAbsolute(file) ? file : join(Deno.cwd(), file);
      if (!existsSync(target)) {
        throw new Error("Render target does not exist: " + file);
      }
      return Deno.realPathSync(target);
    });
  };

  if (files) {
    if (alwaysExecuteFiles) {
      alwaysExecuteFiles = normalizeFiles(alwaysExecuteFiles);
      files = normalizeFiles(files);
    } else if (options.useFreezer) {
      files = normalizeFiles(files);
    }
  }

  // check with the project type to see if we should render all
  // of the files in the project with the freezer enabled (required
  // for projects that produce self-contained output from a
  // collection of input files)
  if (
    files && alwaysExecuteFiles &&
    projType.incrementalRenderAll &&
    await projType.incrementalRenderAll(context, options, files)
  ) {
    files = context.files.input;
    options = { ...options, useFreezer: true };
  }

  // some standard pre and post render script env vars
  const renderAll = !files || (files.length === context.files.input.length);
  const prePostEnv = {
    "QUARTO_PROJECT_OUTPUT_DIR": context.config?.project?.[kProjectOutputDir] ||
      ".",
    ...(renderAll ? { QUARTO_PROJECT_RENDER_ALL: "1" } : {}),
  };

  // default for files if not specified
  files = files || context.files.input;
  const filesToRender: RenderFile[] = files.map((file) => {
    return { path: file };
  });

  // See if the project type needs to add additional render files
  // that should be rendered as a side effect of rendering the file(s)
  // in the render list.
  // We don't add supplemental files when this is a dev server reload
  // to improve render performance
  const projectSupplement = (filesToRender: RenderFile[]) => {
    if (projType.supplementRender && !options.devServerReload) {
      return projType.supplementRender(
        context,
        filesToRender,
        incremental,
      );
    } else {
      return { files: [] };
    }
  };
  const supplements = projectSupplement(filesToRender);
  filesToRender.push(...supplements.files);

  // projResults to return
  const projResults: RenderResult = {
    baseDir: projDir,
    outputDir: context.config?.project?.[kProjectOutputDir],
    files: [],
  };

  // ensure we have the requisite entries in .gitignore
  await ensureGitignore(context.dir);

  // determine whether pre and post render steps should show progress
  const progress = !!options.progress || (filesToRender.length > 1);

  // if there is an output dir then remove it if clean is specified
  const projOutputDir = context.config?.project?.[kProjectOutputDir];
  if (
    renderAll && (typeof (projOutputDir) === "string") &&
    (options.flags?.clean == true)
  ) {
    const realProjectDir = Deno.realPathSync(context.dir);
    let realOutputDir = join(realProjectDir, projOutputDir);
    if (existsSync(realOutputDir)) {
      realOutputDir = Deno.realPathSync(realOutputDir);
      if (
        (realOutputDir !== realProjectDir) &&
        realOutputDir.startsWith(realProjectDir)
      ) {
        removeIfExists(realOutputDir);
      }
    }
  }

  // run pre-render step if we are rendering all files
  if (
    filesToRender.length > 0 && context.config?.project?.[kProjectPreRender]
  ) {
    await runPreRender(
      projDir,
      context.config?.project?.[kProjectPreRender]!,
      progress,
      !!options.flags?.quiet,
      {
        ...prePostEnv,
        QUARTO_PROJECT_INPUT_FILES: filesToRender
          .map((fileToRender) => fileToRender.path)
          .map((file) => relative(projDir, file))
          .join("\n"),
      },
    );
  }

  // lookup the project type and call preRender
  if (projType.preRender) {
    await projType.preRender(context);
  }

  // set execute dir if requested
  const executeDir = context.config?.project?.[kProjectExecuteDir];
  if (options.flags?.executeDir === undefined && executeDir === "project") {
    options = {
      ...options,
      flags: {
        ...options.flags,
        executeDir: projDir,
      },
    };
  }

  // set executeDaemon to 0 for renders of the entire project
  // or a list of more than one file (don't want to leave dozens of
  // kernels in memory)
  if (
    filesToRender.length > 1 && options.flags &&
    options.flags.executeDaemon === undefined
  ) {
    options.flags.executeDaemon = 0;
  }

  // determine the output dir
  const outputDir = projResults.outputDir;
  const outputDirAbsolute = outputDir ? join(projDir, outputDir) : undefined;
  if (outputDirAbsolute) {
    ensureDirSync(outputDirAbsolute);
  }

  // track the lib dir
  const libDir = context.config?.project[kProjectLibDir];

  // function to extract resource files from rendered file
  const resourcesFrom = async (file: RenderedFile) => {
    // resource files
    const partitioned = await partitionedMarkdownForInput(
      projDir,
      file.input,
    );
    const resourceFiles = resourceFilesFromRenderedFile(
      projDir,
      file,
      partitioned,
    );
    return resourceFiles;
  };

  // set QUARTO_PROJECT_DIR
  Deno.env.set("QUARTO_PROJECT_DIR", projDir);
  try {
    // render the files
    const fileResults = await renderFiles(
      filesToRender,
      options,
      alwaysExecuteFiles,
      projType?.pandocRenderer
        ? projType.pandocRenderer(options, context)
        : undefined,
      context,
    );

    if (outputDirAbsolute) {
      // move or copy dir
      const relocateDir = (dir: string, copy = false) => {
        const targetDir = join(outputDirAbsolute, dir);
        if (existsSync(targetDir)) {
          Deno.removeSync(targetDir, { recursive: true });
        }
        const srcDir = join(projDir, dir);
        if (existsSync(srcDir)) {
          ensureDirSync(dirname(targetDir));
          if (copy) {
            copySync(srcDir, targetDir);
          } else {
            Deno.renameSync(srcDir, targetDir);
          }
        }
      };
      const moveDir = relocateDir;
      const copyDir = (dir: string) => relocateDir(dir, true);

      // track whether we need to keep the lib dir around
      let keepLibsDir = false;

      // move/copy projResults to output_dir
      for (let i = 0; i < fileResults.files.length; i++) {
        const renderedFile = fileResults.files[i];

        // move the renderedFile to the output dir
        const outputFile = join(outputDirAbsolute, renderedFile.file);
        ensureDirSync(dirname(outputFile));
        Deno.renameSync(join(projDir, renderedFile.file), outputFile);

        // files dir
        const keepFiles = !!renderedFile.format.execute[kKeepMd];
        keepLibsDir = keepLibsDir || keepFiles;
        if (renderedFile.supporting) {
          // lib-dir is handled separately for projects so filter it out of supporting
          renderedFile.supporting = renderedFile.supporting.filter((file) =>
            file !== libDir
          );
          if (keepFiles) {
            renderedFile.supporting.map((file) => copyDir(file));
          } else {
            renderedFile.supporting.map((file) => moveDir(file));
          }
        }

        // remove empty files dir
        if (!keepFiles) {
          const filesDir = join(
            projDir,
            dirname(renderedFile.file),
            inputFilesDir(renderedFile.file),
          );
          removeIfEmptyDir(filesDir);
        }

        // render file renderedFile
        projResults.files.push({
          input: renderedFile.input,
          markdown: renderedFile.markdown,
          format: renderedFile.format,
          file: renderedFile.file,
          supporting: renderedFile.supporting,
          resourceFiles: await resourcesFrom(renderedFile),
        });
      }

      // move or copy the lib dir if we have one (move one subdirectory at a time
      // so that we can merge with what's already there)
      if (libDir) {
        const libDirFull = join(context.dir, libDir);
        if (existsSync(libDirFull)) {
          // if this is an incremental render or we are uzing the freezer, then
          // copy lib dirs incrementally (don't replace the whole directory).
          // otherwise, replace the whole thing so we get a clean start
          const libsIncremental = !!(incremental || options.useFreezer);

          // determine format lib dirs (for pruning)
          const formatLibDirs = projType.formatLibDirs
            ? projType.formatLibDirs()
            : [];

          // lib dir to freezer
          const freezeLibDir = (hidden: boolean) => {
            copyToProjectFreezer(context, libDir, hidden, false);
            pruneProjectFreezerDir(context, libDir, formatLibDirs, hidden);
            pruneProjectFreezer(context, hidden);
          };

          // copy to hidden freezer
          freezeLibDir(true);

          // if we have a visible freezer then copy to it as well
          if (existsSync(join(context.dir, kProjectFreezeDir))) {
            freezeLibDir(false);
          }

          if (libsIncremental) {
            for (const lib of Deno.readDirSync(libDirFull)) {
              if (lib.isDirectory) {
                const copyDir = join(libDir, lib.name);
                const srcDir = join(projDir, copyDir);
                const targetDir = join(outputDirAbsolute, copyDir);
                copyMinimal(srcDir, targetDir);
                if (!keepLibsDir) {
                  removeIfExists(srcDir);
                }
              }
            }
            if (!keepLibsDir) {
              Deno.removeSync(libDirFull, { recursive: true });
            }
          } else {
            if (keepLibsDir) {
              copyDir(libDir);
            } else {
              moveDir(libDir);
            }
          }
        }
      }

      // determine the output files and filter them out of the resourceFiles
      const outputFiles = projResults.files.map((result) =>
        join(projDir, result.file)
      );
      projResults.files.forEach((file) => {
        file.resourceFiles = file.resourceFiles.filter((resource) =>
          !outputFiles.includes(resource)
        );
      });

      // copy all of the resource files
      const allResourceFiles = ld.uniq(
        (context.files.resources || []).concat(
          projResults.files.flatMap((file) => file.resourceFiles),
        ),
      );

      // copy the resource files to the output dir
      allResourceFiles.forEach((file: string) => {
        const sourcePath = relative(projDir, file);
        const destPath = join(outputDirAbsolute, sourcePath);
        if (existsSync(file)) {
          if (Deno.statSync(file).isFile) {
            copyResourceFile(context.dir, file, destPath);
          }
        } else if (!existsSync(destPath)) {
          warning(`File '${sourcePath}' was not found.`);
        }
      });
    } else {
      for (const result of fileResults.files) {
        const resourceFiles = await resourcesFrom(result);
        projResults.files.push({
          input: result.input,
          markdown: result.markdown,
          format: result.format,
          file: result.file,
          supporting: result.supporting,
          resourceFiles,
        });
      }
    }

    // forward error to projResults
    projResults.error = fileResults.error;

    // call project post-render
    if (!projResults.error) {
      const outputFiles = projResults.files.map((result) => {
        const file = outputDir ? join(outputDir, result.file) : result.file;
        return {
          file: join(projDir, file),
          format: result.format,
        };
      });

      if (projType.postRender) {
        await projType.postRender(
          context,
          incremental,
          outputFiles,
        );
      }

      // run post-render if this isn't incremental
      if (
        filesToRender.length > 0 &&
        context.config?.project?.[kProjectPostRender]
      ) {
        await runPostRender(
          projDir,
          context.config?.project?.[kProjectPostRender]!,
          progress,
          !!options.flags?.quiet,
          {
            ...prePostEnv,
            QUARTO_PROJECT_OUTPUT_FILES: outputFiles
              .map((outputFile) => relative(projDir, outputFile.file))
              .join("\n"),
          },
        );
      }
    }

    // Mark any rendered files as supplemental if that
    // is how they got into the render list
    projResults.files.forEach((file) => {
      if (
        supplements.files.find((supFile) => {
          return supFile.path === join(projDir, file.input);
        })
      ) {
        file.supplemental = true;
      }
    });

    // Also let the project know that the render has completed for
    // any non supplemental files
    const nonSupplementalFiles = projResults.files.filter((file) =>
      !file.supplemental
    ).map((file) => file.file);
    if (supplements.onRenderComplete) {
      await supplements.onRenderComplete(
        context,
        nonSupplementalFiles,
        incremental,
      );
    }

    return projResults;
  } finally {
    Deno.env.delete("QUARTO_PROJECT_DIR");
  }
}

async function runPreRender(
  projDir: string,
  preRender: string[],
  progress: boolean,
  quiet: boolean,
  env?: { [key: string]: string },
) {
  await runScripts(projDir, preRender, progress, quiet, env);
}

async function runPostRender(
  projDir: string,
  postRender: string[],
  progress: boolean,
  quiet: boolean,
  env?: { [key: string]: string },
) {
  await runScripts(projDir, postRender, progress, quiet, env);
}

async function runScripts(
  projDir: string,
  scripts: string[],
  progress: boolean,
  quiet: boolean,
  env?: { [key: string]: string },
) {
  for (let i = 0; i < scripts.length; i++) {
    const args = parseShellRunCommand(scripts[i]);
    const script = args[0];

    if (progress && !quiet) {
      info(colors.bold(colors.blue(`${script}`)));
    }

    const handler = handlerForScript(script);
    if (handler) {
      await handler.run(script, args.splice(1), undefined, {
        cwd: projDir,
        stdout: quiet ? "piped" : "inherit",
        env,
      });
    } else {
      await execProcess({
        cmd: args,
        cwd: projDir,
        stdout: quiet ? "piped" : "inherit",
        env,
      });
    }
  }
  if (scripts.length > 0) {
    info("");
  }
}
