import { basename, dirname, extname, join } from "path/mod.ts";
import type { FormatOptions } from "../../api/format.ts";
import {
  ComputationEngine,
  computationEngineForFile,
} from "../../computation/engine.ts";

export interface ComputationsResult {
  output: string;
}

export async function runComptations(
  input: string,
  options: FormatOptions,
): Promise<ComputationsResult> {
  // run compute engine if appropriate
  const ext = extname(input);
  const engine = computationEngineForFile(ext);
  if (engine) {
    const inputDir = dirname(input);
    const inputBase = basename(input, ext);
    const output = join(inputDir, inputBase + ".md");
    const result = await engine.process(
      input,
      options,
      output,
    );

    // return result
    return {
      output,
    };
  } else {
    return {
      output: input,
    };
  }
}
