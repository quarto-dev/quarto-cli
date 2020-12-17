/*
* filters.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import {
  kBibliography,
  kFigAlign,
  kOutputDivs,
} from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { pdfEngine } from "../../config/pdf.ts";
import { resourcePath } from "../../core/resources.ts";
import {
  crossrefFilter,
  crossrefFilterActive,
  crossrefFilterParams,
} from "./crossref.ts";
import { layoutFilter, layoutFilterParams } from "./layout.ts";
import { PandocOptions } from "./pandoc.ts";

const kQuartoParams = "quarto-params";

export function setFilterParams(options: PandocOptions) {
  const params: Metadata = {
    ...quartoFilterParams(options.format),
    ...crossrefFilterParams(options),
    ...layoutFilterParams(options.format),
  };
  options.format.metadata[kQuartoParams] = params;
}

export function removeFilterParmas(metadata: Metadata) {
  delete metadata[kQuartoParams];
}

export function quartoPreFilter() {
  return resourcePath("filters/quarto-pre/quarto-pre.lua");
}

export function quartoPostFilter() {
  return resourcePath("filters/quarto-post/quarto-post.lua");
}

function quartoFilterParams(format: Format) {
  const params: Metadata = {
    [kOutputDivs]: format.render[kOutputDivs],
  };
  const figAlign = format.render[kFigAlign];
  if (figAlign) {
    params[kFigAlign] = figAlign;
  }
  return params;
}

export function resolveFilters(userFilters: string[], options: PandocOptions) {
  // filter chain
  const filters: string[] = [];

  // always run quarto pre filter
  filters.push(quartoPreFilter());

  // add crossref filter if necessary
  if (crossrefFilterActive(options.format)) {
    filters.push(crossrefFilter());
  }

  // add layout filter
  filters.push(layoutFilter());

  // add quarto post filter
  filters.push(quartoPostFilter());

  // add user filters (remove citeproc if it's there)
  filters.push(...userFilters.filter((filter) => filter !== "citeproc"));

  // citeproc at the very end so all other filters can interact with citations
  const citeproc = citeMethod(options) === "citeproc";
  if (citeproc) {
    filters.push("citeproc");
  }

  // return filters
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
