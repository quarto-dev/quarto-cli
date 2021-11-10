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
import {
  asMappedString,
  mappedConcat,
  mappedIndexToRowCol,
  mappedString,
} from "./mapped-text.ts";
import {
  kLangCommentChars,
  partitionCellOptionsMapped,
} from "./partition-cell-options.ts";
import { PromiseQueue } from "./promise.ts";
import { rangedLines, rangedSubstring } from "./ranged-text.ts";
import {
  indexToRowCol,
  lineOffsets,
  lines,
  normalizeNewlines,
  rowColToIndex,
} from "./text.ts";
import { schemaCompletions, schemaType } from "./schema.ts";
import { setupAjv, YAMLSchema } from "./yaml-schema.ts";

const result = {
  glb,

  breakQuartoMd,

  mappedString,
  asMappedString,
  mappedConcat,
  mappedIndexToRowCol,

  partitionCellOptionsMapped,
  kLangCommentChars,

  PromiseQueue,

  rangedSubstring,
  rangedLines,

  lineOffsets,
  lines,
  normalizeNewlines,
  indexToRowCol,
  rowColToIndex,

  schemaType,
  schemaCompletions,

  YAMLSchema,
  setupAjv,
};

if (window) {
  window._quartoCoreLib = result;
}
