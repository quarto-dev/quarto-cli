/*
* create-project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { basename } from "path/mod.ts";

import { ProcessResult } from "../../core/process.ts";

export interface CreateProjectOptions {
  dir: string;
  type: "collection" | "website" | "book";
  name?: string;
  outputDir?: string;
}

export async function createProject(
  options: CreateProjectOptions,
): Promise<ProcessResult> {
  // provide defaults
  options.name = options.name || basename(options.dir);
  if (!options.outputDir) {
    switch (options.type) {
      case "collection":
        options.outputDir = ".";
        break;
      case "website":
        options.outputDir = "_site";
        break;
      case "book":
        options.outputDir = "_book";
        break;
    }
  }

  console.log(options);
  return {
    success: true,
    code: 0,
  };
}
