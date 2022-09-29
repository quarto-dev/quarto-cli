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

import { HtmlPostProcessResult } from "./types.ts";
import { hasAdaptiveTheme } from "../../quarto-core/text-highlighting.ts";
import { kHtmlEmptyPostProcessResult } from "./constants.ts";

const kAdaptiveTextHighlighting = "adaptive-text-highlighting";

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

export function overflowXPostprocessor(
  doc: Document,
): Promise<HtmlPostProcessResult> {
  // look for cell-output-display (these will have overflow-x set on them which we
  // will want to disable in some conditions)
  const outputs = doc.querySelectorAll(".cell-output-display");
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i] as Element;
    const noOverflowX =
      // select inputs end up having their drop down truncated
      !!output.querySelector("select") ||
      // the rgl htmlwidget barely overflows the container and gets scrollbars
      // see https://github.com/quarto-dev/quarto-cli/issues/1800
      !!output.querySelector(".rglWebGL");
    if (noOverflowX) {
      output.classList.add("no-overflow-x");
    }
  }
  return Promise.resolve(kHtmlEmptyPostProcessResult);
}
