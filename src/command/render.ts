import type { Args } from "flags/mod.ts";
import { basename, dirname, extname, join } from "path/mod.ts";

import { execProcess } from "../core/process.ts";

import {
  computationPreprocessorForFile,
} from "../quarto/quarto-extensions.ts";

import type { Command } from "./command.ts";

export const renderCommand: Command = {
  name: "render",

  arguments: [],

  exec: async (args: Args) => {
    const input = args["_"][1].toString();
    return render(input);
  },
};

export async function render(input: string): Promise<void> {
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
  const result = await execProcess({
    cmd: ["pandoc", output],
  });

  // reject promise on error
  if (!result.success) {
    return Promise.reject(new Error(result.stderr));
  }
}
