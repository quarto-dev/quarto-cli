/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
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
  .arguments("<input-files:string> [...args]")
  .description(
    "Render input file(s) to various document types.",
  )
  .option(
    "-t, --to",
    "Specify output format.",
  )
  .option(
    "-o, --output",
    "Write output to FILE (use '--output -' for stdout).",
  )
  .option(
    "--execute",
    "Execute code (--no-execute to skip execution).",
  )
  .option(
    "--execute-params",
    "YAML file with execution parameters.",
  )
  .option(
    "--execute-root-dir",
    "Working directory for code execution.",
  )
  .option(
    "--cache",
    "Cache execution output (--no-cache to prevent cache).",
  )
  .option(
    "--cache-refresh",
    "Force refresh of execution cache.",
  )
  .option(
    "--debug",
    "Leave intermediate files in place after render.",
  )
  .option(
    "--quiet",
    "Suppress warning and other messages.",
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
  .action(async (options: any, inputFiles: string, args: string[]) => {
    // pull inputs out of the beginning of flags
    const inputs = [inputFiles];
    const firstPandocArg = args.findIndex((arg) => arg.startsWith("-"));
    if (firstPandocArg !== -1) {
      inputs.push(...args.slice(0, firstPandocArg));
      args = args.slice(firstPandocArg);
    }

    // extract pandoc flag values we know/care about, then fixup args as
    // necessary (remove our flags that pandoc doesn't know about)
    const flags = parseRenderFlags(args);
    args = fixupPandocArgs(args, flags);

    // run render on input files
    let rendered = false;
    for (const input of inputs) {
      for (const walk of expandGlobSync(input)) {
        const input = relative(Deno.cwd(), walk.path);
        rendered = true;
        const result = await render(input, { flags, pandocArgs: args });
        if (!result.success) {
          // error diagnostics already written to stderr
          Deno.exit(result.code);
        }
      }
    }
    if (!rendered) {
      throw new Error(`No valid input files passed to render`);
    }
  });
