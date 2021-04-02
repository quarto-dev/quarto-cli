/*
* project-scratch.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";

import { ProjectContext } from "./project-context.ts";

export const kQuartoScratch = ".quarto";

export function projectScratchPath(project: ProjectContext, path = "") {
  const scratchDir = join(project.dir, kQuartoScratch);
  ensureDirSync(scratchDir);
  if (path) {
    path = join(scratchDir, path);
    ensureDirSync(dirname(path));
    return path;
  } else {
    return Deno.realPathSync(scratchDir);
  }
}
