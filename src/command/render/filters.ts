/*
* filters.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Metadata } from "../../config/metadata.ts";
import { crossrefFilterParams } from "./crossref.ts";
import { figuresFilterParams } from "./figures.ts";
import { PandocOptions } from "./pandoc.ts";

const kQuartoParams = "quarto-params";

export function setFilterParams(options: PandocOptions) {
  const params: Metadata = {
    ...crossrefFilterParams(options),
    ...figuresFilterParams(options.format),
  };
  options.format.metadata[kQuartoParams] = params;
}

export function removeFilterParmas(metadata: Metadata) {
  delete metadata[kQuartoParams];
}
