/*
* project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { walkSync } from "fs/mod.ts";
import { expandGlobSync } from "fs/expand_glob.ts";
import { join } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { executionEngine } from "../../execute/engine.ts";

import {
  kExecuteDir,
  ProjectContext,
  projectContext,
} from "../../config/project.ts";

import { renderFiles, RenderOptions } from "./render.ts";

export async function renderProject(
  dir: string,
  options: RenderOptions,
) {
  // get project context
  const context = projectContext(dir);

  // set execute dir if requested
  const executeDir = context.metadata?.project?.[kExecuteDir];
  if (options.flags?.executeDir === undefined && executeDir === "project") {
    options = {
      ...options,
      flags: {
        ...options.flags,
        executeDir: Deno.realPathSync(dir),
      },
    };
  }

  // set QUARTO_PROJECT_DIR
  Deno.env.set("QUARTO_PROJECT_DIR", Deno.realPathSync(dir));
  try {
    const files = projectInputFiles(context);
    await renderFiles(files, options);
  } finally {
    Deno.env.delete("QUARTO_PROJECT_DIR");
  }
}

function projectInputFiles(context: ProjectContext) {
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

  return ld.difference(ld.uniq(files), keepMdFiles);
}
