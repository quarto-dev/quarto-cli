/*
* cleanup.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname } from "path/mod.ts";

import { removeIfExists } from "../../core/path.ts";

import { Format } from "../../config/format.ts";
import { kKeepMd, kKeepTex, kSelfContained } from "../../config/constants.ts";

import type { RenderFlags } from "./flags.ts";
import { ExecuteResult } from "../../execute/engine.ts";

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
  mdOutput: string,
  finalOutput: string,
  supporting: string[],
  tempDir: string,
  keepMd?: string,
) {
  // cleanup md if necessary
  if (keepMd && !format.render[kKeepMd] && keepMd !== finalOutput) {
    removeIfExists(keepMd);
  }

  // always get rid of computations output unless we are in debug mode (it's an intermediate file)
  if (!flags.debug) {
    removeIfExists(mdOutput);
  }

  // determine if we will be self contained
  const selfContained = flags[kSelfContained] ||
    (format.pandoc && format.pandoc[kSelfContained]) ||
    kStandaloneExtensions.includes(extname(finalOutput));

  // if we aren't keeping the markdown and we are self-contained, then
  // delete the supporting files
  if (
    !format.render[kKeepMd] && !format.render[kKeepTex] && selfContained
  ) {
    if (supporting) {
      supporting.forEach((path) => {
        Deno.removeSync(path, { recursive: true });
      });
    }
  }

  // remove the temp dir
  removeIfExists(tempDir);
}
