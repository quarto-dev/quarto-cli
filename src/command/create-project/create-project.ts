/*
* create-project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { basename } from "path/mod.ts";

import { ProcessResult } from "../../core/process.ts";

export const kOutputDir = "output-dir";

export interface CreateProjectOptions {
  dir: string;
  type: "default" | "website" | "book";
  name?: string;
  [kOutputDir]?: string;
}

export async function createProject(
  options: CreateProjectOptions,
): Promise<ProcessResult> {
  // provide defaults
  options.name = options.name || basename(options.dir);
  if (!options[kOutputDir]) {
    switch (options.type) {
      case "default":
        options[kOutputDir] = ".";
        break;
      case "website":
        options[kOutputDir] = "_site";
        break;
      case "book":
        options[kOutputDir] = "_book";
        break;
    }
  }

  console.log(options);
  return {
    success: true,
    code: 0,
  };
}
