// src/core/api/text.ts

import { globalRegistry } from "./registry.ts";
import type { TextNamespace } from "./types.ts";

// Import implementations
import { lineColToIndex, lines, trimEmptyLines } from "../lib/text.ts";
import { postProcessRestorePreservedHtml } from "../jupyter/preserve.ts";
import { executeInlineCodeHandler } from "../execute-inline.ts";
import { asYamlText } from "../jupyter/jupyter-fixups.ts";

// Register text namespace
globalRegistry.register("text", (): TextNamespace => {
  return {
    lines,
    trimEmptyLines,
    postProcessRestorePreservedHtml,
    lineColToIndex,
    executeInlineCodeHandler,
    asYamlText,
  };
});
