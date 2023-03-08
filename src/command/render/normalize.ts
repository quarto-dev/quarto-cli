/*
* authors.ts
*
* Copyright (C) 2020-2023 Posit, PBC
*
*/

import { resourcePath } from "../../core/resources.ts";
import { PandocOptions } from "./types.ts";

export const kMetaNormalizationActive = "metadata-normalization";

export function metadataNormalizationFilter() {
  return resourcePath("filters/normalize/normalize.lua");
}

export function metadataNormalizationFilterActive(options: PandocOptions) {
  return options.format.metadata[kMetaNormalizationActive] !== false;
}
