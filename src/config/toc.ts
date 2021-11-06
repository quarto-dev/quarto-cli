/*
* toc.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kTableOfContents, kToc } from "./constants.ts";
import { Format, PandocFlags } from "./types.ts";

export const kTocFloat = "toc-float";

export function hasTableOfContents(flags: PandocFlags, format: Format) {
  return !!((flags[kToc] || format.pandoc[kToc] ||
    format.pandoc[kTableOfContents]) && (format.metadata[kTocFloat] !== false));
}

export function disabledTableOfContents(format: Format) {
  return format.pandoc[kToc] === false ||
    format.pandoc[kTableOfContents] === false;
}
