/*
* figures.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kPageWidth } from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { resourcePath } from "../../core/resources.ts";

export function figuresFilter() {
  return resourcePath("filters/figures/figures.lua");
}

export function figuresFilterActive(format: Format) {
  return format.metadata.figures !== false;
}

export function figuresFilterParams(format: Format) {
  const params: Metadata = {};
  const pageWidth = format.render[kPageWidth];
  if (pageWidth) {
    params[kPageWidth] = pageWidth;
  }
  return params;
}
