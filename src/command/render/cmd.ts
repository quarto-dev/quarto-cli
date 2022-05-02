/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, relative } from "path/mod.ts";
import { expandGlobSync } from "fs/expand_glob.ts";
import { Command } from "cliffy/command/mod.ts";
import { info } from "log/mod.ts";

import { fixupPandocArgs, kStdOut, parseRenderFlags } from "./flags.ts";

import { renderResultFinalOutput } from "./render.ts";
import { render } from "./render-shared.ts";
import { RenderResult } from "./types.ts";
import { createTempContext } from "../../core/temp.ts";

export const renderCommand = new Command()
  .name("render")
  .stopEarly()
  .arguments("[input:string] [...args]")
  .description(
    "Render input file(s) to various document types.",
  )
  .option(
    "-t, --to",
    "Specify output format(s).",
  )
  .option(
    "-o, --output",
    "Write output to FILE (use '--output -' for stdout).",
  )
  .option(
    "--output-dir",
    "Write project output to DIR (path is project relative)",
  )
  .option(
    "-M, --metadata",
    "Metadata value (KEY:VALUE).",
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
    "--execute-daemon",
    "Keep Jupyter kernel alive (defaults to 300 seconds).",
  )
  .option(
    "--execute-daemon-restart",
    "Restart keepalive Jupyter kernel before render.",
  )
  .option(
    "--execute-debug",
    "Show debug output for Jupyter kernel.",
  )
  .option(
    "--use-freezer",
    "Force use of frozen computations for an incremental file render.",
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
    "--no-clean",
    "Do not clean project output-dir prior to render",
  )
  .option(
    "--debug",
    "Leave intermediate files in place after render.",
  )
  .option(
    "pandoc-args...",
    "Additional pandoc command line arguments.",
  )
  .example(
    "Render Markdown",
    "quarto render document.qmd\n" +
      "quarto render document.qmd --to html\n" +
      "quarto render document.qmd --to pdf --toc",
  )
  .example(
    "Render Notebook",
    "quarto render notebook.ipynb\n" +
      "quarto render notebook.ipynb --to docx\n" +
      "quarto render notebook.ipynb --to pdf --toc",
  )
  .example(
    "Render w/ Metadata",
    "quarto render document.qmd -M echo:false\n" +
      "quarto render document.qmd -M code-fold:true",
  )
  .example(
    "Render to Stdout",
    "quarto render document.qmd --output -",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input?: string, args?: string[]) => {
    args = args || [];

    // remove implicit clean argument (re-injected based on what the user
    // actually passes in flags.ts)
    delete options.clean;

    // if an option got defined then this was mis-parsed as an 'option'
    // rather than an 'arg' because no input was passed. reshuffle
    // things to make them work
    if (Object.keys(options).length === 1) {
      const option = Object.keys(options)[0];
      const optionArg = option.replaceAll(
        /([A-Z])/g,
        (_match: string, p1: string) => `-${p1.toLowerCase()}`,
      );
      if (input) {
        args.unshift(input);
        input = undefined;
      }
      args.unshift("--" + optionArg);
      delete options[option];
    }

    // show help if requested
    if (args.length > 0 && args[0] === "--help") {
      renderCommand.showHelp();
      return;
    }

    // pull inputs out of the beginning of flags
    input = input || ".";
    const inputs = [input];
    const firstPandocArg = args.findIndex((arg) => arg.startsWith("-"));
    if (firstPandocArg !== -1) {
      inputs.push(...args.slice(0, firstPandocArg));
      args = args.slice(firstPandocArg);
    }

    // normalize args (to deal with args like --foo=bar)
    const normalizedArgs = [];
    for (const arg of args) {
      const equalSignIndex = arg.indexOf("=");
      if (equalSignIndex > 0 && arg.startsWith("-")) {
        // Split the arg at the first equal sign
        normalizedArgs.push(arg.slice(0, equalSignIndex));
        normalizedArgs.push(arg.slice(equalSignIndex + 1));
      } else {
        normalizedArgs.push(arg);
      }
    }
    args = normalizedArgs;

    // extract pandoc flag values we know/care about, then fixup args as
    // necessary (remove our flags that pandoc doesn't know about)
    const flags = parseRenderFlags(args);
    args = fixupPandocArgs(args, flags);

    // run render on input files

    let renderResult: RenderResult | undefined;
    let renderResultInput: string | undefined;
    for (const input of inputs) {
      for (const walk of expandGlobSync(input)) {
        const temp = createTempContext();
        try {
          renderResultInput = relative(Deno.cwd(), walk.path) || ".";
          renderResult = await render(renderResultInput, {
            temp,
            flags,
            pandocArgs: args,
            useFreezer: flags.useFreezer === true,
            setProjectDir: true,
          });

          // check for error
          if (renderResult.error) {
            throw renderResult.error;
          }
        } finally {
          temp.cleanup();
        }
      }
    }
    if (renderResult && renderResultInput) {
      // report output created
      if (!options.flags?.quiet && options.flags?.output !== kStdOut) {
        const finalOutput = renderResultFinalOutput(
          renderResult,
          Deno.statSync(renderResultInput).isDirectory
            ? renderResultInput
            : dirname(renderResultInput),
        );

        if (finalOutput) {
          info("Output created: " + finalOutput + "\n");
        }
      }
    } else {
      throw new Error(`No valid input files passed to render`);
    }
  });
