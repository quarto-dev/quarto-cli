/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { expandGlobSync } from "fs/expand_glob.ts";

import { Command } from "cliffy/command/mod.ts";

import { message } from "../../core/console.ts";

import { isHtmlOutput } from "../../config/format.ts";

import { fixupPandocArgs, kStdOut, parseRenderFlags } from "./flags.ts";

import { render, RenderResults } from "./render.ts";

export const renderCommand = new Command()
  .name("render")
  .stopEarly()
  .arguments("[input:string] [...args]")
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
    "-P, --execute-param",
    "Execution parameter (KEY:VALUE).",
  )
  .option(
    "--execute-params",
    "YAML file with execution parameters.",
  )
  .option(
    "--execute-dir",
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
    "--kernel-keepalive",
    "Keep Jupyter kernel alive (defaults to 300 seconds).",
  )
  .option(
    "--kernel-restart",
    "Restart keepalive Jupyter kernel before render.",
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
    "Render Jupyter Markdown",
    "quarto render notebook.md\n" +
      "quarto render notebook.md --to docx --highlight-style=espresso",
  )
  .example(
    "Render Jupyter Notebook",
    "quarto render notebook.ipynb --to docx\n" +
      "quarto render notebook.ipynb --to pdf --toc",
  )
  .example(
    "Render to Standard Output",
    "quarto render notebook.Rmd --output -",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input?: string, args?: string[]) => {
    args = args || [];

    // pull inputs out of the beginning of flags
    input = input || ".";
    const inputs = [input];
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

    let renderResults: RenderResults | undefined;
    for (const input of inputs) {
      for (const walk of expandGlobSync(input)) {
        const input = relative(Deno.cwd(), walk.path) || ".";
        renderResults = await render(input, { flags, pandocArgs: args });
      }
    }
    if (renderResults) {
      // report output created
      if (!options.flags?.quiet && options.flags?.output !== kStdOut) {
        message("Output created: " + finalOutput(renderResults) + "\n");
      }
    } else {
      throw new Error(`No valid input files passed to render`);
    }
  });

function finalOutput(renderResults: RenderResults) {
  // determine final output
  const formats = Object.keys(renderResults.results);
  const format = formats.find((fmt) => isHtmlOutput(fmt)) || formats[0];
  const results = renderResults.results[format];
  const result =
    (results.find((result) => result.file === "index.html") || results[0]);

  let finalInput = result.input;
  let finalOutput = result.file;

  if (renderResults.baseDir) {
    finalInput = join(renderResults.baseDir, finalInput);
    if (renderResults.outputDir) {
      finalOutput = join(
        renderResults.baseDir,
        renderResults.outputDir,
        finalOutput,
      );
    } else {
      finalOutput = join(renderResults.baseDir, finalOutput);
    }
  } else {
    finalOutput = join(dirname(finalInput), finalOutput);
  }

  // return a path relative to the input file
  const inputRealPath = Deno.realPathSync(finalInput);
  const outputRealPath = Deno.realPathSync(finalOutput);
  return relative(dirname(inputRealPath), outputRealPath);
}
