// src/core/api/markdown-regex.ts

import { globalRegistry } from "./registry.ts";
import type { MarkdownRegexNamespace } from "./types.ts";

// Import implementations
import { readYamlFromMarkdown } from "../yaml.ts";
import {
  languagesInMarkdown,
  partitionMarkdown,
} from "../pandoc/pandoc-partition.ts";
import { breakQuartoMd } from "../lib/break-quarto-md.ts";

// Register markdownRegex namespace
globalRegistry.register("markdownRegex", (): MarkdownRegexNamespace => {
  return {
    extractYaml: readYamlFromMarkdown,
    partition: partitionMarkdown,
    getLanguages: languagesInMarkdown,
    breakQuartoMd,
  };
});
