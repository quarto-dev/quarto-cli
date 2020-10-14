import { basename } from "path/mod.ts";

import type { Format } from "../../api/format.ts";
import { kSelfContained } from "../../config/constants.ts";

import type { ComputationsResult } from "./computation.ts";
import type { RenderFlags } from "./flags.ts";

export function cleanup(
  flags: RenderFlags,
  format: Format,
  computations: ComputationsResult,
  output: string,
) {
  // if keep.md is requested then copy markdown created by computations to output.md
  if (format.keep?.md) {
    Deno.copyFileSync(
      computations.output,
      basename(output, "." + format.output?.ext) + ".md",
    );
  }

  // always remove markdown created by computations
  Deno.removeSync(computations.output);

  // determine if we will be self contained
  const selfContained = flags[kSelfContained] ||
    (format.pandoc && format.pandoc[kSelfContained]);

  // if we aren't keeping the markdown and we are self-contained, then
  // delete the supporting files
  if (!format.keep?.md && selfContained) {
    if (computations.supporting) {
      computations.supporting.forEach((path) => {
        Deno.removeSync(path, { recursive: true });
      });
    }
  }
}
