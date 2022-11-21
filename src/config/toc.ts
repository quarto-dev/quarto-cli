/*
* toc.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { kTableOfContents, kToc } from "./constants.ts";
import { Format, PandocFlags } from "./types.ts";

export function hasTableOfContents(flags: PandocFlags, format: Format) {
  return !!(flags[kToc] || format.pandoc[kToc] ||
    format.pandoc[kTableOfContents]);
}

export function disabledTableOfContents(format: Format) {
  return format.pandoc[kToc] === false ||
    format.pandoc[kTableOfContents] === false;
}
