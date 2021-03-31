/*
* project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { copySync, ensureDirSync, existsSync } from "fs/mod.ts";
import { basename, dirname, join, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { resolvePathGlobs } from "../../core/path.ts";
import { message } from "../../core/console.ts";

import { kKeepMd } from "../../config/constants.ts";

import {
  kExecuteDir,
  kLibDir,
  kOutputDir,
  ProjectContext,
} from "../../project/project-context.ts";

import { projectType } from "../../project/types/project-types.ts";
import { copyResourceFile } from "../../project/project-resources.ts";
import { ensureGitignore } from "../../project/project-gitignore.ts";

import { renderFiles, RenderOptions, RenderResult } from "./render.ts";

export async function renderProject(
  context: ProjectContext,
  incremental: boolean,
  options: RenderOptions,
  files?: string[],
): Promise<RenderResult> {
  // get real path to the project
  const projDir = Deno.realPathSync(context.dir);

  // default for files if not specified
  files = files || context.files.input;

  // projResults to return
  const projResults: RenderResult = {
    baseDir: projDir,
    outputDir: context.metadata?.project?.[kOutputDir],
    files: [],
  };

  // ensure we have the requisite entries in .gitignore
  await ensureGitignore(context);

  // lookup the project type and call preRender
  const projType = projectType(context.metadata?.project?.type);
  if (projType.preRender) {
    await projType.preRender(context);
  }

  // set execute dir if requested
  const executeDir = context.metadata?.project?.[kExecuteDir];
  if (options.flags?.executeDir === undefined && executeDir === "project") {
    options = {
      ...options,
      flags: {
        ...options.flags,
        executeDir: projDir,
      },
    };
  }

  // set kernelKeepalive to 0 for renders of the entire project
  // or a list of more than one file (don't want to leave dozens of
  // kernels in memory)
  if (
    files.length > 1 && options.flags &&
    options.flags.kernelKeepalive === undefined
  ) {
    options.flags.kernelKeepalive = 0;
  }

  // set QUARTO_PROJECT_DIR
  Deno.env.set("QUARTO_PROJECT_DIR", projDir);
  try {
    // render the files
    const fileResults = await renderFiles(files, options, context, incremental);

    // move to the output directory if we have one
    const outputDir = projResults.outputDir;

    if (outputDir) {
      // resolve output dir and ensure that it exists
      let realOutputDir = join(projDir, outputDir);
      ensureDirSync(realOutputDir);
      realOutputDir = Deno.realPathSync(realOutputDir);

      // move or copy dir
      const relocateDir = (dir: string, copy = false) => {
        const targetDir = join(realOutputDir, dir);
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

      // move/copy projResults to output_dir
      Object.keys(fileResults).forEach((format) => {
        const results = fileResults[format];

        for (const result of results) {
          // move the output file
          const outputFile = join(realOutputDir, result.file);
          ensureDirSync(dirname(outputFile));
          Deno.renameSync(join(projDir, result.file), outputFile);

          // files dir
          if (result.filesDir) {
            if (result.format.render[kKeepMd]) {
              copyDir(result.filesDir);
            } else {
              moveDir(result.filesDir);
            }
          }

          // resource files
          const resourceDir = join(projDir, dirname(result.file));
          const globs = result.resourceFiles.globs;
          const fileResourceFiles = globs.length > 0
            ? resolvePathGlobs(
              resourceDir,
              result.resourceFiles.globs,
              [],
            )
            : { include: [], exclude: [] };

          // add the explicitly discovered files (if they exist and
          // the output isn't self-contained)
          if (!result.selfContained) {
            const resultFiles = result.resourceFiles.files
              .map((file) => join(resourceDir, file))
              .filter(existsSync)
              .map(Deno.realPathSync);
            fileResourceFiles.include.push(...resultFiles);
          }

          // apply removes and filter files dir
          const resourceFiles = fileResourceFiles.include.filter(
            (file: string) => {
              if (fileResourceFiles.exclude.includes(file)) {
                return false;
              } else if (
                result.filesDir &&
                file.startsWith(join(projDir, result.filesDir!))
              ) {
                return false;
              } else {
                return true;
              }
            },
          );

          // render file result
          projResults.files.push({
            input: result.input,
            markdown: result.markdown,
            format: result.format,
            file: result.file,
            filesDir: result.filesDir,
            resourceFiles,
          });
        }
      });

      // move or copy the lib dir if we have one (move one subdirectory at a time
      // so that we can merge with what's already there)
      const libDir = context.metadata?.project?.[kLibDir];
      if (libDir) {
        const libDirFull = join(context.dir, libDir);
        if (existsSync(libDirFull)) {
          for (const lib of Deno.readDirSync(libDirFull)) {
            if (lib.isDirectory) {
              moveDir(join(libDir, basename(lib.name)));
            }
          }
          Deno.removeSync(libDirFull, { recursive: true });
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
        const destPath = join(realOutputDir, sourcePath);
        if (existsSync(file)) {
          if (Deno.statSync(file).isFile) {
            copyResourceFile(context.dir, file, destPath);
          }
        } else if (!existsSync(destPath)) {
          message(`WARNING: File '${sourcePath}' was not found.`);
        }
      });
    } else {
      // track output files
      Object.keys(fileResults).forEach((format) => {
        projResults.files.push(
          ...fileResults[format].map((result) => {
            return {
              input: result.input,
              markdown: result.markdown,
              format: result.format,
              file: result.file,
              filesDir: result.filesDir,
              resourceFiles: [],
            };
          }),
        );
      });
    }

    // call post-render
    if (projType.postRender) {
      await projType.postRender(
        context,
        incremental,
        projResults.files.map((result) => {
          const file = outputDir ? join(outputDir, result.file) : result.file;
          return {
            file: join(projDir, file),
            format: result.format,
          };
        }),
      );
    }

    return projResults;
  } finally {
    Deno.env.delete("QUARTO_PROJECT_DIR");
  }
}
