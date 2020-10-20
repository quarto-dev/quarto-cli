/*
* cleanup.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { basename, dirname, extname, join, normalize } from "path/mod.ts";

import type { Format } from "../../api/format.ts";

import { removeIfExists } from "../../core/path.ts";

import { kKeepMd, kKeepTex, kSelfContained } from "../../config/constants.ts";

import type { ComputationsResult } from "./computation.ts";
import type { RenderFlags } from "./flags.ts";

export function cleanup(
  input: string,
  flags: RenderFlags,
  format: Format,
  computations: ComputationsResult,
  output: string,
) {
  // remove md file created by computations
  if (!format?.[kKeepMd]) {
    // don't remove computational output if it's the same as either
    // (1) the original input (which would be the case for rendering
    // a plain markdown file); or (2) The final output (which would
    // be the case for a markdown to markdown rendering)
    if (
      normalize(computations.output) !== normalize(input) &&
      normalize(computations.output) !== normalize(output)
    ) {
      removeIfExists(computations.output);
    }
  }

  // determine if we will be self contained
  const selfContained = flags[kSelfContained] ||
    (format.pandoc && format.pandoc[kSelfContained]) ||
    extname(output) === ".pdf";

  // if we aren't keeping the markdown and we are self-contained, then
  // delete the supporting files
  if (!format?.[kKeepMd] && !format?.[kKeepTex] && selfContained) {
    if (computations.supporting) {
      computations.supporting.forEach((path) => {
        Deno.removeSync(path, { recursive: true });
      });
    }
  }
}
