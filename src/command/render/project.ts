/*
* project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureDirSync, existsSync, walkSync } from "fs/mod.ts";
import { basename, dirname, join, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { resolvePathGlobs } from "../../core/path.ts";
import { message } from "../../core/console.ts";

import { fileExecutionEngine } from "../../execute/engine.ts";

import {
  kExecuteDir,
  kLibDir,
  kOutputDir,
  ProjectContext,
} from "../../project/project-context.ts";

import {
  ProjectOutputFile,
  projectType,
} from "../../project/types/project-types.ts";
import {
  copyResourceFile,
  projectResourceFiles,
} from "../../project/project-resources.ts";
import { ensureGitignore } from "../../project/project-gitignore.ts";

import { renderFiles, RenderOptions, RenderResults } from "./render.ts";

export async function renderProject(
  context: ProjectContext,
  files: string[],
  incremental: boolean,
  options: RenderOptions,
): Promise<RenderResults> {
  // get real path to the project
  const projDir = Deno.realPathSync(context.dir);

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
    // track output files (for postRender hook)
    const outputFiles: ProjectOutputFile[] = [];

    // render the files
    const fileResults = await renderFiles(files, options, context, incremental);

    // move to the output directory if we have one
    const outputDir = context.metadata?.project?.[kOutputDir];

    if (outputDir) {
      // determine global list of included resource files
      let resourceFiles = projectResourceFiles(context);

      // resolve output dir and ensure that it exists
      let realOutputDir = join(projDir, outputDir);
      ensureDirSync(realOutputDir);
      realOutputDir = Deno.realPathSync(realOutputDir);

      // function to move a directory into the output dir
      const moveDir = (dir: string) => {
        const targetDir = join(realOutputDir, dir);
        if (existsSync(targetDir)) {
          Deno.removeSync(targetDir, { recursive: true });
        }
        const srcDir = join(projDir, dir);
        if (existsSync(srcDir)) {
          ensureDirSync(dirname(targetDir));
          Deno.renameSync(srcDir, targetDir);
        }
      };

      // move the lib dir if we have one (move one subdirectory at a time so that we can
      // merge with what's already there)
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

      // move/copy results to output_dir
      Object.keys(fileResults).forEach((format) => {
        const results = fileResults[format];

        for (const result of results) {
          // output file
          const outputFile = join(realOutputDir, result.file);
          ensureDirSync(dirname(outputFile));
          Deno.renameSync(join(projDir, result.file), outputFile);
          outputFiles.push({
            file: outputFile,
            format: result.format,
          });

          // files dir
          if (result.filesDir) {
            moveDir(result.filesDir);
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

          // merge the resolved globs into the global list
          resourceFiles.push(...fileResourceFiles.include);

          // add the explicitly discovered files (if they exist and
          // the output isn't self-contained)
          if (!result.selfContained) {
            const resultFiles = result.resourceFiles.files
              .map((file) => join(resourceDir, file))
              .filter(existsSync)
              .map(Deno.realPathSync);
            resourceFiles.push(...resultFiles);
          }

          // apply removes and filter files dir
          resourceFiles = resourceFiles.filter((file: string) => {
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
          });
        }
      });

      // make resource files unique then remove directories
      resourceFiles = ld.uniq(resourceFiles);

      // copy the resource files to the output dir
      resourceFiles.forEach((file: string) => {
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
        outputFiles.push(
          ...fileResults[format].map((result) => {
            return {
              file: join(projDir, result.file),
              format: result.format,
            };
          }),
        );
      });
    }

    // call post-render
    if (projType.postRender) {
      await projType.postRender(context, incremental, outputFiles);
    }

    return {
      baseDir: context.dir,
      outputDir: outputDir,
      results: fileResults,
    };
  } finally {
    Deno.env.delete("QUARTO_PROJECT_DIR");
  }
}

export function projectInputFiles(context: ProjectContext) {
  const files: string[] = [];
  const keepFiles: string[] = [];

  const outputDir = context.metadata?.project?.[kOutputDir];

  const addFile = (file: string) => {
    if (!outputDir || !file.startsWith(join(context.dir, outputDir))) {
      const engine = fileExecutionEngine(file);
      if (engine) {
        files.push(file);
        const keep = engine.keepFiles(file);
        if (keep) {
          keepFiles.push(...keep);
        }
      }
    }
  };

  const addDir = (dir: string) => {
    for (
      const walk of walkSync(
        dir,
        { includeDirs: false, followSymlinks: true, skip: [/[/\\][_\.]/] },
      )
    ) {
      addFile(walk.path);
    }
  };

  const renderFiles = context.metadata?.project?.render;
  if (renderFiles) {
    const exclude = outputDir ? [outputDir] : [];
    const resolved = resolvePathGlobs(context.dir, renderFiles, exclude);
    (ld.difference(resolved.include, resolved.exclude) as string[])
      .forEach((file) => {
        if (Deno.statSync(file).isDirectory) {
          addDir(file);
        } else {
          addFile(file);
        }
      });
  } else {
    addDir(context.dir);
  }

  const inputFiles = ld.difference(
    ld.uniq(files),
    ld.uniq(keepFiles),
  ) as string[];
  return inputFiles;
}
