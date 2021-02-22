/*
* project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// Execution/Paths:

//  Output:
//  - Auto-detect references to static resources (links, img[src], raw HTML refs including CSS) and copy them
//  - Project type can include resource-files patterns (e.g. *.css)
//  - Explicit resource files
//  resource-files: (also at project level)
//    **/*.xls (implicit ** unless '/')
//
//    /*.xls
//
//    - negation: we expand the negation and then remove those files from the existing list
//    - !secret.css
//    - resume.pdf

//  Websites:
//    - Navigation
//    - sitemap.xml
//    - search

import { copySync, ensureDirSync, existsSync, walkSync } from "fs/mod.ts";
import { dirname, join, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { resolvePathGlobs } from "../../core/path.ts";
import { message } from "../../core/console.ts";

import { executionEngine } from "../../execute/engine.ts";

import {
  kExecuteDir,
  kOutputDir,
  kResourceFiles,
  ProjectContext,
} from "../../config/project.ts";

import { renderFiles, RenderOptions, RenderResults } from "./render.ts";

export async function renderProject(
  context: ProjectContext,
  files: string[],
  options: RenderOptions,
): Promise<RenderResults> {
  // get real path to the project
  const projDir = Deno.realPathSync(context.dir);

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

  // set QUARTO_PROJECT_DIR
  Deno.env.set("QUARTO_PROJECT_DIR", projDir);
  try {
    // render the files
    const fileResults = await renderFiles(files, options, context);

    // move to the output directory if we have one
    const outputDir = context.metadata?.project?.[kOutputDir];

    if (outputDir) {
      // determine global list of included resource files
      let resourceFiles: string[] = [];
      const resourceFileGlobs = context.metadata?.project?.[kResourceFiles];
      if (resourceFileGlobs) {
        const exclude = outputDir ? [outputDir] : [];
        const projectResourceFiles = resolvePathGlobs(
          context.dir,
          resourceFileGlobs,
          exclude,
        );
        resourceFiles.push(
          ...ld.difference(
            projectResourceFiles.include,
            projectResourceFiles.exclude,
          ),
        );
      }

      // resolve output dir and ensure that it exists
      let realOutputDir = join(projDir, outputDir);
      ensureDirSync(realOutputDir);
      realOutputDir = Deno.realPathSync(realOutputDir);

      // move/copy results to output_dir
      Object.keys(fileResults).forEach((format) => {
        const results = fileResults[format];

        for (const result of results) {
          // output file
          const outputFile = join(realOutputDir, result.file);
          ensureDirSync(dirname(outputFile));
          Deno.renameSync(join(projDir, result.file), outputFile);

          // files dir
          const filesDir = result.filesDir
            ? join(realOutputDir, result.filesDir)
            : undefined;
          if (filesDir) {
            if (existsSync(filesDir)) {
              Deno.removeSync(filesDir, { recursive: true });
            }
            Deno.renameSync(
              join(projDir, result.filesDir!),
              filesDir,
            );
          }

          // resource files
          const fileResourceFiles = resolvePathGlobs(
            join(projDir, dirname(result.file)),
            result.resourceFiles,
            [],
          );

          // merge the resource files into the global list
          resourceFiles.push(...fileResourceFiles.include);

          // apply removes and filter files dir
          resourceFiles = resourceFiles.filter((file) => {
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

      // make resource files unique
      resourceFiles = ld.uniq(resourceFiles);

      // copy the resource files to the output dir
      resourceFiles.forEach((file) => {
        const sourcePath = relative(projDir, file);
        if (existsSync(file)) {
          const destPath = join(realOutputDir, sourcePath);
          ensureDirSync(dirname(destPath));
          copySync(file, destPath, {
            overwrite: true,
            preserveTimestamps: true,
          });
        } else {
          message(`WARNING: File '${sourcePath}' was not found.`);
        }
      });
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
  const keepMdFiles: string[] = [];

  const addFile = (file: string) => {
    const engine = executionEngine(file);
    if (engine) {
      files.push(file);
      const keepMd = engine.keepMd(file);
      if (keepMd) {
        keepMdFiles.push(keepMd);
      }
    }
  };

  const addDir = (dir: string) => {
    for (
      const walk of walkSync(
        dir,
        { includeDirs: false, followSymlinks: true, skip: [/^_/] },
      )
    ) {
      addFile(walk.path);
    }
  };

  const renderFiles = context.metadata?.project?.render;
  if (renderFiles) {
    const outputDir = context.metadata?.project?.[kOutputDir];
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

  return ld.difference(ld.uniq(files), keepMdFiles) as string[];
}
