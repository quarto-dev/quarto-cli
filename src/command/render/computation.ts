import { basename, dirname, extname, join } from "path/mod.ts";

import type { FormatOptions } from "../../api/format.ts";

import {
  computationEngineForFile,
} from "../../computation/engine.ts";

export interface ComputationsResult {
  output: string;
  supporting: string[];
}

export interface ComputationsOptions {
  input: string;
  format: FormatOptions;
  quiet?: boolean;
}

export async function runComptations(
  options: ComputationsOptions,
): Promise<ComputationsResult> {
  // compute file paths
  const ext = extname(options.input);
  const engine = computationEngineForFile(ext);
  const inputDir = dirname(options.input);
  const inputBase = basename(options.input, ext);
  const output = join(inputDir, inputBase + ".quarto.md");

  // run compute engine if appropriate
  const supporting: string[] = [];
  if (engine) {
    const result = await engine.process(
      options.input,
      options.format,
      output,
      options.quiet,
    );
    if (result.supporting) {
      supporting.push(...result.supporting);
    }
  } else {
    await Deno.copyFile(options.input, output);
  }

  // return result
  return {
    output,
    supporting,
  };
}
