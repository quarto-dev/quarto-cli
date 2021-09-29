/**
* index.ts
*
* imports all of core lib for the esbuild target
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

// export * from "./binary-search.ts";
// export * from "./break-quarto-md.ts";
// export * from "./mapped-text.ts";
// export * from "./partition-cell-options.ts";
// export * from "./ranged-text.ts";
// export * from "./text.ts";

import { glb } from "./binary-search.ts";
import { breakQuartoMd } from "./break-quarto-md.ts";
import { mappedString, asMappedString, mappedConcat, mappedIndexToRowCol } from "./mapped-text.ts";
import { partitionCellOptionsMapped } from "./partition-cell-options.ts";
import { rangedSubstring, rangedLines } from "./ranged-text.ts";
import { lines, normalizeNewlines, indexToRowCol, rowColToIndex } from "./text.ts";

const result = {
  glb,
  breakQuartoMd,
  mappedString,
  asMappedString,
  mappedConcat,
  mappedIndexToRowCol,
  partitionCellOptionsMapped,
  rangedSubstring,
  rangedLines,
  lines,
  normalizeNewlines,

  indexToRowCol,
  rowColToIndex
};

if (window) {
  window._quartoCoreLib = result;
}
