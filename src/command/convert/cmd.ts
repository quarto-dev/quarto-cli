/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { exists } from "fs/exists.ts";
import { join } from "path/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";
import { dirAndStem } from "../../core/path.ts";
import {
  convertMarkdownToNotebook,
  convertNotebookToMarkdown,
} from "./convert.ts";

const kNotebookFormat = "notebook";
const kMarkdownFormat = "markdown";

export const convertCommand = new Command()
  .name("convert")
  .arguments("[path:string]")
  .description(
    "Convert between markdown and notebook representations of documents.",
  )
  .option(
    "-t, --to <format:string>",
    "Format to convert to (markdown or notebook)",
  )
  .option(
    "--output",
    "Write output to FILE (use '--output -' for stdout).",
  )
  .option(
    "--no-ids",
    "Don't convert Jupyter cell ids",
  )
  .example(
    "Convert notebook to markdown",
    "quarto convert mydocument.ipynb --to markdown",
  )
  .example(
    "Convert markdown to notebook",
    "quarto convert mydocument.md --to notebook",
  )
  .example(
    "Convert notebook to markdown, writing to filename",
    "quarto convert mydocument.ipynb --to markdown --output mydoc.qmd",
  )
  .example(
    "Convert notebook to markdown, writing to stdout",
    "quarto convert mydocument.ipynb --to markdown --output -",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, path: string) => {
    if (!await exists(path)) {
      throw new Error(`File not found: '${path}'`);
    }

    // determine source format
    const srcFormat = isJupyterNotebook(path)
      ? kNotebookFormat
      : kMarkdownFormat;

    // determine and validate target format
    const targetFormat = options.to ||
      (srcFormat === kNotebookFormat ? kMarkdownFormat : kNotebookFormat);
    if (![kNotebookFormat, kMarkdownFormat].includes(targetFormat)) {
      throw new Error("Invalid target format: " + targetFormat);
    }
    if (
      srcFormat === kNotebookFormat && targetFormat !== kMarkdownFormat ||
      srcFormat === kMarkdownFormat && targetFormat !== kNotebookFormat
    ) {
      throw new Error(`Unable to convert ${srcFormat} to ${targetFormat}`);
    }

    // are we converting ids?
    const includeIds = !!options.ids;

    // perform conversion
    const converted = srcFormat === kNotebookFormat
      ? convertNotebookToMarkdown(path)
      : await convertMarkdownToNotebook(path, includeIds);

    // write output
    const [dir, stem] = dirAndStem(path);
    let output = options.output;
    if (!output) {
      output = join(
        dir,
        stem + (targetFormat === kNotebookFormat ? ".ipynb" : ".md"),
      );
    }
    if (output === "-") {
      Deno.stdout.writeSync(new TextEncoder().encode(converted));
    } else {
      Deno.writeTextFileSync(output, converted);
    }
  });
