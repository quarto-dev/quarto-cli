/*
* figures.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kFigAlign, kPageWidth } from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { resourcePath } from "../../core/resources.ts";

export function figuresFilter() {
  return resourcePath("filters/figures/figures.lua");
}

export function figuresFilterParams(format: Format) {
  const params: Metadata = {};
  const pageWidth = format.render[kPageWidth];
  if (pageWidth) {
    params[kPageWidth] = pageWidth;
  }
  const figAlign = format.render[kFigAlign];
  if (figAlign) {
    params[kFigAlign] = figAlign;
  }
  return params;
}
