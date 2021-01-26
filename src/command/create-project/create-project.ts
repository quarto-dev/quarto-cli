/*
* create-project.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

import { basename } from "path/mod.ts";
import { jupyterKernelspec } from "../../core/jupyter/kernels.ts";
import { pandocListFormats } from "../../core/pandoc/pandoc-formats.ts";

export const kOutputDir = "output-dir";

export interface CreateProjectOptions {
  dir: string;
  type: "default" | "website" | "book";
  formats?: string[];
  scaffold: string[] | false;
  name?: string;
  [kOutputDir]?: string;
}

export async function createProject(
  options: CreateProjectOptions,
) {
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

  // validate/complete scaffold if it's jupyter
  if (Array.isArray(options.scaffold) && options.scaffold[0] === "jupyter") {
    const kernel = options.scaffold[1];
    const kernelspec = await jupyterKernelspec(kernel);
    if (!kernelspec) {
      throw new Error(
        `Specified jupyter kernel ('${kernel}') not found.`,
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
}
