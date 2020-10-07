import { basename } from "https://deno.land/std@0.71.0/path/mod.ts";
import type { FormatOptions } from "../../api/format.ts";

import type { ComputationsResult } from "./computation.ts";
import type { RenderFlags } from "./flags.ts";

export function cleanup(
  flags: RenderFlags,
  options: FormatOptions,
  computations: ComputationsResult,
  output: string,
) {
  // if keep.md is requested then copy markdown created by computations to output.md
  if (options.keep?.md) {
    Deno.copyFileSync(
      computations.output,
      basename(output, options.output?.ext) + "md",
    );
  }

  // always remove markdown created by computations
  Deno.removeSync(computations.output);

  // determine if we will be self contained
  const selfContained = flags["self-contained"] ||
    options.pandoc!["self-contained"];

  // if we aren't keeping the markdown and we are self-contained, then
  // delete the supporting files
  if (!options.keep?.md && selfContained) {
    computations.supporting.forEach((path) => {
      Deno.removeSync(path, { recursive: true });
    });
  }
}
