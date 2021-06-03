/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { exists } from "fs/exists.ts";
import { join } from "path/mod.ts";
import { info } from "log/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";
import { dirAndStem } from "../../core/path.ts";
import {
  jupyterNotebookToMarkdown,
  markdownToJupyterNotebook,
} from "./jupyter.ts";
import { isObservableUrl, observableNotebookToMarkdown } from "./observable.ts";

const kNotebookFormat = "notebook";
const kMarkdownFormat = "markdown";

export const convertCommand = new Command()
  .name("convert")
  .arguments("[input:string]")
  .description(
    "Convert between markdown and notebook representations of documents.",
  )
  .option(
    "--output [path:string]",
    "Write output to PATH (use '--output -' for stdout).",
  )
  .option(
    "--no-ids",
    "Don't convert Jupyter cell ids",
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
  .example(
    "Convert observable notebook to markdown",
    "quarto convert https://observablehq.com/@observablehq/javascript-and-observable",
  )
  .example(
    "Convert observable notebook to markdown, writing to dir",
    "quarto convert https://observablehq.com/@observablehq/javascript-and-observable --output js-and-observable",
  )
  .example(
    "Convert notebook to markdown, writing to stdout",
    "quarto convert mydocument.ipynb --output -",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input: string) => {
    // separate codepath for observable urls
    if (isObservableUrl(input)) {
      await observableNotebookToMarkdown(
        input,
        options.output as string | undefined,
      );
    } else {
      if (!await exists(input)) {
        throw new Error(`File not found: '${input}'`);
      }

      // determine source format
      const srcFormat = isJupyterNotebook(input)
        ? kNotebookFormat
        : kMarkdownFormat;

      // are we converting ids?
      const includeIds = !!options.ids;

      // perform conversion
      const converted = srcFormat === kNotebookFormat
        ? jupyterNotebookToMarkdown(input, includeIds)
        : await markdownToJupyterNotebook(input, includeIds);

      // write output
      const [dir, stem] = dirAndStem(input);
      let output = options.output;
      if (!output) {
        output = join(
          dir,
          stem + (srcFormat === kMarkdownFormat ? ".ipynb" : ".qmd"),
        );
      }
      if (output === "-") {
        Deno.stdout.writeSync(new TextEncoder().encode(converted));
      } else {
        Deno.writeTextFileSync(output, converted);
        info(`Converted to ${output}`);
      }
    }
  });
