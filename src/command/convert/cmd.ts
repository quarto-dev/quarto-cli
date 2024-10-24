/*
 * cmd.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { existsSync } from "../../deno_ral/fs.ts";
import { join } from "../../deno_ral/path.ts";
import { info } from "../../deno_ral/log.ts";

import { Command, Option } from "npm:clipanion";
import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";
import { dirAndStem } from "../../core/path.ts";
import {
  jupyterNotebookToMarkdown,
  markdownToJupyterNotebook,
} from "./jupyter.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";

const kNotebookFormat = "notebook";
const kMarkdownFormat = "markdown";

export class ConvertCommand extends Command {
  static name = 'convert';
  static paths = [[ConvertCommand.name]];

  static usage = Command.Usage({
    description: "Convert documents to alternate representations.",
    examples: [
      [
        "Convert notebook to markdown",
        `$0 ${ConvertCommand.name} mydocument.ipynb`,
      ], [
        "Convert markdown to notebook",
        `$0 ${ConvertCommand.name} mydocument.qmd`,
      ], [
        "Convert notebook to markdown, writing to file",
        `$0 ${ConvertCommand.name} mydocument.ipynb --output mydoc.qmd`,
      ]
    ]
  })

  input = Option.String({ required: true });

  output = Option.String("-o,--output", { description: "Write output to PATH." });
  withIds = Option.Boolean("--with-ids", { description: "Include ids in conversion" });

  async execute() {
    const { input } = this;
    await initYamlIntelligenceResourcesFromFilesystem();

    if (!existsSync(input)) {
      throw new Error(`File not found: '${input}'`);
    }

    // determine source format
    const srcFormat = isJupyterNotebook(input)
      ? kNotebookFormat
      : kMarkdownFormat;

    // are we converting ids?
    const withIds = this.withIds === undefined ? false : !!this.withIds;

    // perform conversion
    const converted = srcFormat === kNotebookFormat
      ? await jupyterNotebookToMarkdown(input, withIds)
      : await markdownToJupyterNotebook(input, withIds);

    // write output
    const [dir, stem] = dirAndStem(input);
    let output = this.output;
    if (!output) {
      output = join(
        dir,
        stem + (srcFormat === kMarkdownFormat ? ".ipynb" : ".qmd"),
      );
    }
    Deno.writeTextFileSync(output, converted);
    info(`Converted to ${output}`);
  }
}
