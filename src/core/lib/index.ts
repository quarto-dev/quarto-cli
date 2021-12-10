/**
* index.ts
*
* reexports all of core lib for the esbuild target
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

export { glb } from "./binary-search.ts";
export { breakQuartoMd } from "./break-quarto-md.ts";
export {
  asMappedString,
  mappedConcat,
  mappedIndexToRowCol,
  mappedString,
} from "./mapped-text.ts";
export {
  kLangCommentChars,
  partitionCellOptionsMapped,
} from "./partition-cell-options.ts";
export { PromiseQueue } from "./promise.ts";
export { rangedLines, rangedSubstring } from "./ranged-text.ts";
export {
  indexToRowCol,
  lineOffsets,
  lines,
  matchAll,
  normalizeNewlines,
  rowColToIndex,
} from "./text.ts";

export {
  expandAliasesFrom,
  getSchemaDefinition,
  getSchemaDefinitionsObject,
  schemaCompletions,
  schemaType,
  setSchemaDefinition,
} from "./schema.ts";

export { setupAjv, YAMLSchema } from "./yaml-schema.ts";
export { withValidator } from "./validator-queue.ts";
export { prefixes } from "./regexp.js";
