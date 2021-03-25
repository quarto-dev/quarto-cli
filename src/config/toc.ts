/*
* toc.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kTableOfContents, kToc, kTocTitle } from "./constants.ts";
import { PandocFlags } from "./flags.ts";
import { Format } from "./format.ts";

export const kTocFloat = "toc-float";

export function hasTableOfContents(flags: PandocFlags, format: Format) {
  return !!((flags[kToc] || format.pandoc[kToc] ||
    format.pandoc[kTableOfContents]) && (format.metadata[kTocFloat] !== false));
}

export function hasTableOfContentsTitle(flags: PandocFlags, format: Format) {
  return flags[kTocTitle] !== undefined ||
    format.metadata[kTocTitle] !== undefined;
}
