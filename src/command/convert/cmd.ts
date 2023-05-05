/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { info } from "log/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";
import { dirAndStem } from "../../core/path.ts";
import {
  jupyterNotebookToMarkdown,
  markdownToJupyterNotebook,
} from "./jupyter.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";

const kNotebookFormat = "notebook";
const kMarkdownFormat = "markdown";

export const convertCommand = new Command()
  .name("convert")
  .arguments("<input:string>")
  .description(
    "Convert documents to alternate representations.",
  )
  .option(
    "-o, --output [path:string]",
    "Write output to PATH.",
  )
  .option(
    "--with-ids",
    "Include ids in conversion",
  )
  .example(
    "Convert notebook to markdown",
    "quarto convert mydocument.ipynb ",
  )
  .example(
    "Convert markdown to notebook",
    "quarto convert mydocument.qmd",
  )
  .example(
    "Convert notebook to markdown, writing to file",
    "quarto convert mydocument.ipynb --output mydoc.qmd",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input: string) => {
    await initYamlIntelligenceResourcesFromFilesystem();

    if (!existsSync(input)) {
      throw new Error(`File not found: '${input}'`);
    }

    // determine source format
    const srcFormat = isJupyterNotebook(input)
      ? kNotebookFormat
      : kMarkdownFormat;

    // are we converting ids?
    const withIds = options.withIds === undefined ? false : !!options.withIds;

    // perform conversion
    const converted = srcFormat === kNotebookFormat
      ? await jupyterNotebookToMarkdown(input, withIds)
      : await markdownToJupyterNotebook(input, withIds);

    // write output
    const [dir, stem] = dirAndStem(input);
    let output = options.output;
    if (!output) {
      output = join(
        dir,
        stem + (srcFormat === kMarkdownFormat ? ".ipynb" : ".qmd"),
      );
    }
    Deno.writeTextFileSync(output, converted);
    info(`Converted to ${output}`);
  });
