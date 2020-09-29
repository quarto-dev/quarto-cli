import { Command } from "cliffy/command/mod.ts";
import { basename, dirname, extname, join } from "path/mod.ts";
import { writeLine } from "../core/console.ts";

import { execProcess, ProcessResult } from "../core/process.ts";

import {
  computationPreprocessorForFile,
} from "../quarto/quarto-extensions.ts";

// --to pandoc:html

export const renderCommand = new Command()
  .name("render <input:string>")
  .description("Render a file")
  .option(
    "-t, --to [to:string]",
    "Specify output format to convert to (e.g. pandoc:html5)",
  )
  .option(
    "-o, --output [output:string]",
    "Write to output file instead of stdout",
  )
  .option(
    "-d, --defaults [defaults:string]",
    "Specify a set of pandoc command line arguments (https://pandoc.org/MANUAL.html#default-files).",
  )
  .option(
    "--data-dir [data-dir:string]",
    "Specify the user data directory to search for pandoc data files.",
  )
  .example(
    "Render R Markdown",
    `quarto render notebook.Rmd`,
  )
  .example(
    "Render Jupyter Notebook",
    `quarto render notebook.ipynb`,
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input: string) => {
    try {
      const result = await render({ input, ...options });
      if (result.success) {
        if (options.output) {
          writeLine(Deno.stderr, "Output created: " + options.output + "\n");
        }
      } else {
        // error diagnostics already written to stderr
        Deno.exit(result.code);
      }
    } catch (error) {
      // error diagnostics already written to stderr
      Deno.exit(1);
    }
  });

export interface RenderOptions {
  input: string;
  to?: string;
  output?: string;
  defaults?: string;
  "data-dir"?: string;
}

export async function render(options: RenderOptions): Promise<ProcessResult> {
  // determine path to mdInput file and preprocessor
  let preprocessorOutput: string;

  // execute computational preprocessor (if any)
  const ext = extname(options.input);
  const preprocessor = computationPreprocessorForFile(ext);
  if (preprocessor) {
    const inputDir = dirname(options.input);
    const inputBase = basename(options.input, ext);
    preprocessorOutput = join(inputDir, inputBase + ".md");
    await preprocessor.preprocess(options.input, preprocessorOutput);
  } else {
    preprocessorOutput = options.input;
  }

  // build the pandoc command
  const cmd = ["pandoc", preprocessorOutput];
  if (options.output) {
    cmd.push("--output", options.output);
  }
  if (options.to) {
    cmd.push("--to", options.to.replace(/^pandoc:/, ""));
  }
  if (options.defaults) {
    cmd.push("--defaults", options.defaults);
  }
  if (options["data-dir"]) {
    cmd.push("--data-dir", options["data-dir"]);
  }

  // print command line
  writeLine(Deno.stdout, "\n" + cmd.join(" ") + "\n");

  // run pandoc
  return execProcess({ cmd });
}
