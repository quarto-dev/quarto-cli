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
import { expandGlobSync } from "fs/expand_glob.ts";

import { Command } from "cliffy/command/mod.ts";

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
    "-t, --to",
    "Specify output format.",
    { default: "html" },
  )
  .option(
    "-o, --output",
    "Write output to FILE (use '--output -' for stdout).",
  )
  .option(
    "--format-options",
    "YAML file specifying additional output format options.",
  )
  .option(
    "--compute-params",
    "Computation parameters (in YAML file). Specify 'ask' to prompt for values.",
  )
  .option(
    "--compute-dir",
    "Working directory for computations (e.g. knitr, nbconvert).",
  )
  .option(
    "--debug",
    "Leave intermediate files in place after render.",
    { default: false },
  )
  .option(
    "--quiet",
    "Suppress warning and other messages.",
    { default: false },
  )
  .option(
    "pandoc-args...",
    "Additional pandoc command line arguments.",
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
    for (const input of inputs) {
      for (const walk of expandGlobSync(input)) {
        const input = relative(Deno.cwd(), walk.path);
        const result = await render({ input, flags, pandocArgs });
        if (!result.success) {
          // error diagnostics already written to stderr
          Deno.exit(result.code);
        }
      }
    }
  });
