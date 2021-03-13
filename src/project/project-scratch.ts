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
  path = join(project.dir, kQuartoScratch, path);
  ensureDirSync(dirname(path));
  return path;
}
