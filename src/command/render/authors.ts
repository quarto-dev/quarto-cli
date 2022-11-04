/*
* authors.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { PandocOptions } from "./types.ts";

export const kAuthorsActive = "author-parsing";

export function authorsFilterActive(options: PandocOptions) {
  return options.format.metadata[kAuthorsActive] !== false;
}
