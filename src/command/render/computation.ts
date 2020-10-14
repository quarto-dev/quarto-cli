import { basename, dirname, extname, join } from "path/mod.ts";

import type { Format, FormatPandoc } from "../../api/format.ts";

import { pandocIncludesOptions } from "../../core/pandoc.ts";

import { computationEngineForFile } from "../../computation/engine.ts";

export interface ComputationsResult {
  output: string;
  supporting: string[];
  preserved: { [key: string]: string };
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
    const result = await engine.execute(
      options.input,
      options.format,
      output,
      options.quiet,
    );

    return {
      output,
      supporting: result.supporting,
      preserved: result.preserved,
      pandoc: pandocIncludesOptions(result.includes),
    };
    // no compute engine, just copy the file
  } else {
    await Deno.copyFile(options.input, output);
    return {
      output,
      supporting: [],
      preserved: {},
      pandoc: {},
    };
  }
}

export interface PostProcessOptions {
  input: string;
  format: Format;
  output: string;
  preserved: { [key: string]: string };
  quiet?: boolean;
}

export async function postProcess(
  options: PostProcessOptions,
): Promise<string> {
  const engine = computationEngineForFile(extname(options.input));
  if (engine && engine.postProcess) {
    return engine.postProcess(
      options.format,
      options.output,
      options.preserved,
      options.quiet,
    );
  } else {
    return Promise.resolve(options.output);
  }
}
