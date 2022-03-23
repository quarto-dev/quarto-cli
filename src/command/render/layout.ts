/*
* layout.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "../../core/deno-dom.ts";

import { kPageWidth } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { Metadata } from "../../config/types.ts";
import { resourcePath } from "../../core/resources.ts";
import { HtmlPostProcessResult, kHtmlEmptyPostProcessResult } from "./types.ts";
import { hasAdaptiveTheme } from "../../quarto-core/text-highlighting.ts";

const kAdaptiveTextHighlighting = "adaptive-text-highlighting";

export function layoutFilter() {
  return resourcePath("filters/layout/layout.lua");
}

export function layoutFilterParams(format: Format) {
  const params: Metadata = {};
  const pageWidth = format.render[kPageWidth];
  if (pageWidth) {
    params[kPageWidth] = pageWidth;
  }

  if (hasAdaptiveTheme(format.pandoc)) {
    params[kAdaptiveTextHighlighting] = true;
  }

  return params;
}

export function selectInputPostprocessor(
  doc: Document,
): Promise<HtmlPostProcessResult> {
  // look for cell-output-display (these will have overflow-x set on them which we
  // will want to disable if there are seledct inputs inside)
  const outputs = doc.querySelectorAll(".cell-output-display");
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i] as Element;
    const hasSelect = !!output.querySelector("select");
    if (hasSelect) {
      output.classList.add("no-overflow-x");
    }
  }
  return Promise.resolve(kHtmlEmptyPostProcessResult);
}
