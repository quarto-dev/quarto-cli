/*
* authors.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { resourcePath } from "../../core/resources.ts";
import { PandocOptions } from "./types.ts";

export const kAuthorsActive = "author-parsing";

export function authorsFilter() {
  return resourcePath("filters/authors/authors.lua");
}

export function authorsFilterActive(options: PandocOptions) {
  return options.format.metadata[kAuthorsActive] !== false;
}
