/*
* layout.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kPageWidth } from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { resourcePath } from "../../core/resources.ts";

export function layoutFilter() {
  return resourcePath("filters/layout/layout.lua");
}

export function layoutFilterParams(format: Format) {
  const params: Metadata = {};
  const pageWidth = format.render[kPageWidth];
  if (pageWidth) {
    params[kPageWidth] = pageWidth;
  }
  return params;
}
