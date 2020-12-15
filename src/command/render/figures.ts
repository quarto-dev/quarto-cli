/*
* figures.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kPageWidth } from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import { Metadata, setFormatMetadata } from "../../config/metadata.ts";
import { resourcePath } from "../../core/resources.ts";

const kQuartoOptionPrefix = "quarto-";

export function figuresFilter() {
  return resourcePath("filters/figures/figures.lua");
}

export function figuresFilterActive(format: Format) {
  return format.metadata.figures !== false;
}

export function forwardFiguresOptions(format: Format) {
  const pageWidth = format.render[kPageWidth];
  if (pageWidth) {
    setFiguresMetadata(
      format,
      `${kQuartoOptionPrefix}${kPageWidth}`,
      pageWidth,
    );
  }
}

export function cleanForwardedFiguresMetadata(metadata: Metadata) {
  if (metadata.figures) {
    const figures = metadata.figures as Record<string, unknown>;
    Object.keys(figures).forEach((key) => {
      if (key.startsWith(kQuartoOptionPrefix)) {
        delete figures[key];
      }
    });
    if (Object.keys(figures).length === 0) {
      delete metadata.figures;
    }
  }
}

function setFiguresMetadata(
  format: Format,
  key: string,
  value: unknown,
) {
  setFormatMetadata(format, "figures", key, value);
}
