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

import { ensureDirSync, existsSync, walkSync } from "fs/mod.ts";
import { expandGlobSync } from "fs/expand_glob.ts";
import { dirname, join } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { executionEngine } from "../../execute/engine.ts";

import {
  kExecuteDir,
  kOutputDir,
  ProjectContext,
} from "../../config/project.ts";

import { renderFiles, RenderOptions } from "./render.ts";
import { resolvePathGlobs } from "../../core/path.ts";

export async function renderProject(
  context: ProjectContext,
  files: string[],
  options: RenderOptions,
) {
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
    let outputDir = context.metadata?.project?.[kOutputDir];

    if (outputDir) {
      // resolve output dir and ensure that it exists
      outputDir = join(projDir, outputDir);
      ensureDirSync(outputDir);
      outputDir = Deno.realPathSync(outputDir);

      // move results to output_dir
      Object.values(fileResults).forEach((results) => {
        for (const result of results) {
          const outputFile = join(outputDir!, result.file);
          ensureDirSync(dirname(outputFile));
          Deno.renameSync(join(projDir, result.file), outputFile);
          if (result.filesDir) {
            const targetDir = join(outputDir!, result.filesDir);
            if (existsSync(targetDir)) {
              Deno.removeSync(targetDir, { recursive: true });
            }
            Deno.renameSync(join(projDir, result.filesDir), targetDir);
          }
        }
      });
    }
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
