/*
* create-project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

import { basename } from "path/mod.ts";
import { pandocListFormats } from "../../core/pandoc/pandoc-formats.ts";

import { ProcessResult } from "../../core/process.ts";

export const kOutputDir = "output-dir";

export interface CreateProjectOptions {
  dir: string;
  type: "default" | "website" | "book";
  name?: string;
  [kOutputDir]?: string;
  formats?: string[];
}

export async function createProject(
  options: CreateProjectOptions,
): Promise<ProcessResult> {
  // validate formats
  if (options.formats) {
    const validFormats = await pandocListFormats();
    const invalid = ld.difference(options.formats, validFormats);
    if (invalid.length > 0) {
      throw new Error(
        `The following formats are invalid: ${invalid.join(", ")}`,
      );
    }
  }

  // provide default name
  options.name = options.name || basename(options.dir);

  // provide default output-dir
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
