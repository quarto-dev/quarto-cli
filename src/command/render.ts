import { Command } from "cliffy/command/mod.ts";
import { basename, dirname, extname, join } from "path/mod.ts";

import { execProcess, ProcessResult } from "../core/process.ts";

import {
  computationPreprocessorForFile,
} from "../quarto/quarto-extensions.ts";

export const renderCommand = new Command()
  .name("render <input:string>")
  .description("Render a file")
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, input: string) => {
    const result = await render(input);
    if (!result.success) {
      Deno.exit(result.code);
    }
  });

export async function render(input: string): Promise<ProcessResult> {
  // determine output file and preprocessor
  let output: string;

  // execute computational preprocessor (if any)
  const ext = extname(input);
  const preprocessor = computationPreprocessorForFile(ext);
  if (preprocessor) {
    const inputDir = dirname(input);
    const inputBase = basename(input, ext);
    output = join(inputDir, inputBase + ".md");
    await preprocessor.preprocess(input, output);
  } else {
    output = input;
  }

  // run pandoc
  return execProcess({
    cmd: ["pandoc", output],
  });
}
