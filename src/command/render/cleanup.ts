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

import { extname, normalize } from "path/mod.ts";

import { removeIfExists } from "../../core/path.ts";

import { Format } from "../../config/format.ts";
import { kKeepMd, kKeepTex, kSelfContained } from "../../config/constants.ts";

import type { ComputationsResult } from "./computation.ts";
import type { RenderFlags } from "./flags.ts";

// some extensions are 'known' to be standalone/self-contained
// see https://pandoc.org/MANUAL.html#option--standalone
const kStandaloneExtensions = [
  ".pdf",
  ".epub",
  ".fb2",
  ".docx",
  ".rtf",
  ".pptx",
  ".odt",
  ".ipynb",
];

export function cleanup(
  flags: RenderFlags,
  format: Format,
  computations: ComputationsResult,
  output: string,
) {
  console.log(computations);

  // always get rid of computations output unless we are in debug mode (it's an intermediate file)
  if (!flags.debug) {
    removeIfExists(computations.output);
  }

  // determine if we will be self contained
  const selfContained = flags[kSelfContained] ||
    (format.pandoc && format.pandoc[kSelfContained]) ||
    kStandaloneExtensions.includes(extname(output));

  // if we aren't keeping the markdown and we are self-contained, then
  // delete the supporting files
  if (
    !format.render[kKeepMd] && !format.render[kKeepTex] && selfContained
  ) {
    if (computations.supporting) {
      computations.supporting.forEach((path) => {
        Deno.removeSync(path, { recursive: true });
      });
    }
  }
}
