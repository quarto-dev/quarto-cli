// src/core/api/format.ts

import { globalRegistry } from "./registry.ts";
import type { FormatNamespace } from "./types.ts";

// Import implementations
import {
  isHtmlCompatible,
  isHtmlDashboardOutput,
  isIpynbOutput,
  isLatexOutput,
  isMarkdownOutput,
  isPresentationOutput,
} from "../../config/format.ts";
import { isServerShiny, isServerShinyPython } from "../render.ts";

// Register format namespace
globalRegistry.register("format", (): FormatNamespace => {
  return {
    isHtmlCompatible,
    isIpynbOutput,
    isLatexOutput,
    isMarkdownOutput,
    isPresentationOutput,
    isHtmlDashboardOutput: (format?: string) => !!isHtmlDashboardOutput(format),
    isServerShiny,
    isServerShinyPython,
  };
});
