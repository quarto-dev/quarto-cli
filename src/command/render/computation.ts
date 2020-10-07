import { basename, dirname, extname, join } from "path/mod.ts";
import type { FormatOptions, FormatPandocOptions } from "../../api/format.ts";
import {
  computationEngineForFile,
} from "../../computation/engine.ts";

export interface ComputationsResult {
  output: string;
}

export interface ComputationsOptions {
  input: string;
  format: FormatOptions;
  quiet?: boolean;
}

export async function runComptations(
  options: ComputationsOptions,
): Promise<ComputationsResult> {
  // run compute engine if appropriate
  const ext = extname(options.input);
  const engine = computationEngineForFile(ext);
  if (engine) {
    const inputDir = dirname(options.input);
    const inputBase = basename(options.input, ext);
    const output = join(inputDir, inputBase + ".md");
    const result = await engine.process(
      options.input,
      options.format,
      output,
      options.quiet,
    );

    // return result
    return {
      output,
    };
  } else {
    return {
      output: options.input,
    };
  }
}
