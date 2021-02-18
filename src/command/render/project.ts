/*
* project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// Execution/Paths:

// - Pandoc filter to convert all '/' links and image refs to project relative
//   (may need to process raw HTML for resource references).

//  Output:
//  - Copy everything (doc, doc_files) to output_dir (if specified, could be .)
//  - Auto-detect references to static resources (links, img[src], raw HTML refs including CSS)
//  - Project type can include resource-files patterns (e.g. *.css)
//  - Explicit resource files
//  resource-files: (also at project level)
//    *.css
//    - !secret.css
//    - resume.pdf
//    include:
//    exclude:

//  Websites:
//    - Navigation
//    - sitemap.xml
//    - search

import { walkSync } from "fs/mod.ts";
import { expandGlobSync } from "fs/expand_glob.ts";
import { join } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { executionEngine } from "../../execute/engine.ts";

import { kExecuteDir, ProjectContext } from "../../config/project.ts";

import { renderFiles, RenderOptions } from "./render.ts";

export async function renderProject(
  context: ProjectContext,
  files: string[],
  options: RenderOptions,
) {
  // set execute dir if requested
  const executeDir = context.metadata?.project?.[kExecuteDir];
  if (options.flags?.executeDir === undefined && executeDir === "project") {
    options = {
      ...options,
      flags: {
        ...options.flags,
        executeDir: Deno.realPathSync(context.dir),
      },
    };
  }

  // set QUARTO_PROJECT_DIR
  Deno.env.set("QUARTO_PROJECT_DIR", Deno.realPathSync(context.dir));
  try {
    const results = await renderFiles(files, options);
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

  const targetDir = Deno.realPathSync(context.dir);
  const renderFiles = context.metadata?.project?.render;
  if (renderFiles) {
    // make project relative

    const projGlobs = renderFiles
      .map((file) => {
        return join(context.dir, file);
      });

    // expand globs
    for (const glob of projGlobs) {
      for (const file of expandGlobSync(glob)) {
        if (file.isFile) { // exclude dirs
          const targetFile = Deno.realPathSync(file.path);
          // filter by dir
          if (targetFile.startsWith(targetDir)) {
            addFile(file.path);
          }
        }
      }
    }
  } else {
    for (
      const walk of walkSync(
        context.dir,
        { includeDirs: false, followSymlinks: true, skip: [/^_/] },
      )
    ) {
      addFile(walk.path);
    }
  }

  return ld.difference(ld.uniq(files), keepMdFiles) as string[];
}
