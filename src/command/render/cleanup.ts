import type { FormatOptions } from "../../api/format.ts";

import type { ComputationsResult } from "./computation.ts";
import type { RenderFlags } from "./flags.ts";

export function cleanup(
  flags: RenderFlags,
  options: FormatOptions,
  computations: ComputationsResult,
) {
  // remove markdown created by computation engine unless keep.md is requested
  if (!options.keep?.md) {
    Deno.removeSync(computations.output);
  }

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
