/*
* filters.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { kBibliography, kOutputDivs } from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { pdfEngine } from "../../config/pdf.ts";
import { resourcePath } from "../../core/resources.ts";
import {
  crossrefFilter,
  crossrefFilterActive,
  crossrefFilterParams,
} from "./crossref.ts";
import {
  figuresFilter,
  figuresFilterActive,
  figuresFilterParams,
} from "./figures.ts";
import { PandocOptions } from "./pandoc.ts";

const kQuartoParams = "quarto-params";

export function setFilterParams(options: PandocOptions) {
  const params: Metadata = {
    ...quartoFilterParams(options.format),
    ...crossrefFilterParams(options),
    ...figuresFilterParams(options.format),
  };
  options.format.metadata[kQuartoParams] = params;
}

export function removeFilterParmas(metadata: Metadata) {
  delete metadata[kQuartoParams];
}

export function quartoFilter() {
  return resourcePath("filters/quarto/quarto.lua");
}

function quartoFilterParams(format: Format) {
  const params: Metadata = {
    [kOutputDivs]: format.render[kOutputDivs],
  };
  return params;
}

export function resolveFilters(
  filters: string[] | undefined,
  options: PandocOptions,
) {
  filters = filters || [];

  // add figures filter
  if (figuresFilterActive(options.format)) {
    filters.unshift(figuresFilter());
  }

  // add citeproc filter if necessary
  const citeproc = citeMethod(options) === "citeproc";
  if (citeproc && !filters.includes("citeproc")) {
    filters.unshift("citeproc");
  }

  // add crossref filter if necessary (unshift will put it before citeproc)
  if (crossrefFilterActive(options.format)) {
    filters.unshift(crossrefFilter());
  }

  // add quarto filter
  filters.unshift(quartoFilter());

  if (filters.length > 0) {
    return filters;
  } else {
    return undefined;
  }
}

type CiteMethod = "citeproc" | "natbib" | "biblatex";

function citeMethod(options: PandocOptions): CiteMethod | null {
  // no handler if no references
  const pandoc = options.format.pandoc;
  const metadata = options.format.metadata;
  if (!metadata[kBibliography] && !metadata.references) {
    return null;
  }

  // collect config
  const pdf = pdfEngine(options.format.pandoc, options.flags);

  // if it's pdf-based output check for natbib or biblatex
  if (pdf?.bibEngine) {
    return pdf.bibEngine;
  }

  // otherwise it's citeproc unless expressly disabled
  if (pandoc.citeproc !== false) {
    return "citeproc";
  } else {
    return null;
  }
}
