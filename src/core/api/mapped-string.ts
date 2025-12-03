// src/core/api/mapped-string.ts

import { globalRegistry } from "./registry.ts";
import type { MappedStringNamespace } from "./types.ts";

// Import implementations
import {
  asMappedString,
  mappedIndexToLineCol,
  mappedLines,
  mappedNormalizeNewlines,
} from "../lib/mapped-text.ts";
import { mappedStringFromFile } from "../mapped-text.ts";
import type { MappedString } from "../lib/text-types.ts";

// Register mappedString namespace
globalRegistry.register("mappedString", (): MappedStringNamespace => {
  return {
    fromString: asMappedString,
    fromFile: mappedStringFromFile,
    normalizeNewlines: mappedNormalizeNewlines,
    splitLines: (str: MappedString, keepNewLines?: boolean) => {
      return mappedLines(str, keepNewLines);
    },
    indexToLineCol: (str: MappedString, offset: number) => {
      const fn = mappedIndexToLineCol(str);
      return fn(offset);
    },
  };
});
