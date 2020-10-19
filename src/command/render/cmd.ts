/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { relative } from "path/mod.ts";
import { expandGlob } from "fs/expand_glob.ts";

import { Command } from "cliffy/command/mod.ts";

import { consoleWriteLine } from "../../core/console.ts";

import { fixupPandocArgs, parseRenderFlags } from "./flags.ts";

import { render } from "./render.ts";

export const renderCommand = new Command()
  .name("render")
  .stopEarly()
  .arguments("<input-files:string> [...pandoc-args:string]")
  .description(
    "Render input file(s) to various document types.",
  )
  .option(
    "-t, --to [to:string]",
    "Specify output format (defaults to html).",
  )
  .option(
    "-o, --output [output:string]",
    "Write output to FILE (use '--output -' for stdout).",
  )
  .option(
    "--self-contained [self-contained:boolean]",
    "Produce a standalone HTML file with no external dependencies, using data: URIs to incorporate the contents of linked scripts, stylesheets, images, and videos",
  )
  .option(
    "--keep-all [keep-all:boolean]",
    "Keep all intermediate files (e.g. markdown, tex, plots, etc.) even when producing a --self-contained document.",
  )
  .option(
    "--compute-dir [compute-dir:string]",
    "Working directory for computational preprocessing (e.g. knitr, nbconvert)",
  )
  .option(
    "--params [params:string]",
    "YAML file with parameter values (or 'ask' to prompt)",
  )
  .option(
    "--quiet [quiet:boolean]",
    "Suppress warning and other messages.",
  )
  .option(
    "pandoc-args... [...pandoc-args:string]",
    "Additional pandoc command line arguments. " +
      "See pandoc --help for documentation on all available options.",
  )
  .example(
    "Render R Markdown",
    "quarto render notebook.Rmd\n" +
      "quarto render notebook.Rmd --to html\n" +
      "quarto render notebook.Rmd --to pdf --toc",
  )
  .example(
    "Render Jupyter Notebook",
    "quarto render notebook.ipynb\n" +
      "quarto render notebook.ipynb --to docx\n" +
      "quarto render notebook.ipynb --to docx --highlight-style=espresso\n",
  )
  .example(
    "Render to Standard Output",
    "quarto render notebook.Rmd --output -",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, inputFiles: string, pandocArgs: string[]) => {
    try {
      // pull inputs out of the beginning of flags
      const inputs = [inputFiles];
      const firstPandocArg = pandocArgs.findIndex((arg) => arg.startsWith("-"));
      if (firstPandocArg !== -1) {
        inputs.push(...pandocArgs.slice(0, firstPandocArg));
        pandocArgs = pandocArgs.slice(firstPandocArg);
      }

      // extract pandoc flag values we know/care about, then fixup args as
      // necessary (remove our flags that pandoc doesn't know about)
      const flags = parseRenderFlags(pandocArgs);
      pandocArgs = fixupPandocArgs(pandocArgs, flags);

      // run render on input files
      for await (const input of inputs) {
        for await (const walk of expandGlob(input)) {
          const input = relative(Deno.cwd(), walk.path);
          const result = await render({ input, flags, pandocArgs });
          if (!result.success) {
            // error diagnostics already written to stderr
            Deno.exit(result.code);
          }
        }
      }
    } catch (error) {
      if (error) {
        consoleWriteLine(error.toString());
      }
      Deno.exit(1);
    }
  });
