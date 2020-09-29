import { Command } from "cliffy/command/mod.ts";
import { basename, dirname, extname, join } from "path/mod.ts";

import { execProcess, ProcessResult } from "../core/process.ts";

import {
  computationPreprocessorForFile,
} from "../quarto/quarto-extensions.ts";

export const renderCommand = new Command()
  .name("render <input:string>")
  .description("Render a file")
  .option(
    "-o, --output [output:string]",
    "Write to output file instead of stdout",
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
    const result = await render(input, options.output);
    if (!result.success) {
      Deno.exit(result.code);
    }
  });

export async function render(
  input: string,
  output?: string,
): Promise<ProcessResult> {
  // determine path to mdInput file and preprocessor
  let preprocessorOutput: string;

  // execute computational preprocessor (if any)
  const ext = extname(input);
  const preprocessor = computationPreprocessorForFile(ext);
  if (preprocessor) {
    const inputDir = dirname(input);
    const inputBase = basename(input, ext);
    preprocessorOutput = join(inputDir, inputBase + ".md");
    await preprocessor.preprocess(input, preprocessorOutput);
  } else {
    preprocessorOutput = input;
  }

  // build the pandoc command
  const cmd = ["pandoc", preprocessorOutput];
  if (output) {
    cmd.push("--output", output);
  }

  // run pandoc
  return execProcess({ cmd });
}
