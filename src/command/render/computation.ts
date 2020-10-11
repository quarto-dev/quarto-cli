import { basename, dirname, extname, join } from "path/mod.ts";

import type { Format, FormatPandoc } from "../../api/format.ts";

import { pandocIncludesOptions } from "../../core/pandoc.ts";

import {
  computationEngineForFile,
} from "../../computation/engine.ts";

export interface ComputationsResult {
  output: string;
  supporting: string[];
  pandoc: FormatPandoc;
}

export interface ComputationsOptions {
  input: string;
  format: Format;
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
  if (engine) {
    const result = await engine.process(
      options.input,
      options.format,
      output,
      options.quiet,
    );

    return {
      output,
      supporting: result.supporting,
      pandoc: pandocIncludesOptions(result.includes),
    };
    // no compute engine, just copy the file
  } else {
    await Deno.copyFile(options.input, output);
    return {
      output,
      supporting: [],
      pandoc: {},
    };
  }
}
