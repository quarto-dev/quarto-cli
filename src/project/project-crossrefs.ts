/*
* project-crossrefs.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { isAbsolute, join, relative } from "path/mod.ts";

import { projectScratchPath } from "./project-scratch.ts";

export function crossrefIndexForOutputFile(projectDir: string, output: string) {
  if (isAbsolute(output)) {
    output = relative(projectDir, output);
  }
  return projectScratchPath(projectDir, join("crossrefs", `${output}.json`));
}
