/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { exists } from "fs/exists.ts";

import { Command } from "cliffy/command/mod.ts";
import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";

type ConvertFormat = "markdown" | "ipynb";

export const convertCommand = new Command()
  .name("convert")
  .arguments("[path:string]")
  .description(
    "Convert between markdown and ipynb representations of documents.",
  )
  .option(
    "-t, --to <format:string>",
    "Format to convert to (markdown or ipynb)",
  )
  .option(
    "--output",
    "Write output to FILE (use '--output -' for stdout).",
  )
  .example(
    "Convert ipynb to markdown",
    "quarto convert mydocument.ipynb --to markdown",
  )
  .example(
    "Convert markdown to ipynb",
    "quarto convert mydocument.md --to ipynb",
  )
  .example(
    "Convert ipynb to markdown, writing to filename",
    "quarto convert mydocument.ipynb --to markdown --output mydoc.qmd",
  )
  .example(
    "Convert ipynb to markdown, writing to stdout",
    "quarto convert mydocument.ipynb --to markdown --output -",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, path: string) => {
    if (!await exists(path)) {
      throw new Error(`File not found: '${path}'`);
    }

    // determine source format
    const srcFormat = isJupyterNotebook(path) ? "jupyter" : "markdown";

    // determine and validate target format
    // const targetFormat = options.to ||
    //   (srcFormat === "jupyter" ? "markdown" : "jupyter");
  });
