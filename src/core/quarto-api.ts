// src/core/quarto-api.ts

// Import types from quarto-cli, not quarto-types
import { MappedString } from "./lib/text-types.ts";
import { Metadata } from "../config/types.ts";
import { PartitionedMarkdown } from "./pandoc/types.ts";

/**
 * Global Quarto API interface
 */
export interface QuartoAPI {
  /**
   * Markdown processing utilities using regex patterns
   */
  markdownRegex: {
    /**
     * Extract and parse YAML frontmatter from markdown
     *
     * @param markdown - Markdown content with YAML frontmatter
     * @returns Parsed metadata object
     */
    extractYaml: (markdown: string) => Metadata;

    /**
     * Split markdown into components (YAML, heading, content)
     *
     * @param markdown - Markdown content
     * @returns Partitioned markdown with yaml, heading, and content sections
     */
    partition: (markdown: string) => PartitionedMarkdown;

    /**
     * Extract programming languages from code blocks
     *
     * @param markdown - Markdown content to analyze
     * @returns Set of language identifiers found in fenced code blocks
     */
    getLanguages: (markdown: string) => Set<string>;
  };

  /**
   * MappedString utilities for source location tracking
   */
  mappedString: {
    /**
     * Create a mapped string from plain text
     *
     * @param text - Text content
     * @param fileName - Optional filename for source tracking
     * @returns MappedString with identity mapping
     */
    fromString: (text: string, fileName?: string) => MappedString;

    /**
     * Read a file and create a mapped string
     *
     * @param path - Path to the file to read
     * @returns MappedString with file content and source information
     */
    fromFile: (path: string) => MappedString;

    /**
     * Normalize newlines while preserving source mapping
     *
     * @param markdown - MappedString to normalize
     * @returns MappedString with \r\n converted to \n
     */
    normalizeNewlines: (markdown: MappedString) => MappedString;
  };
}

// Create the implementation of the quartoAPI
import { readYamlFromMarkdown } from "../core/yaml.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";
import { languagesInMarkdown } from "../execute/engine-shared.ts";
import {
  asMappedString,
  mappedNormalizeNewlines
} from "../core/lib/mapped-text.ts";
import { mappedStringFromFile } from "../core/mapped-text.ts";

/**
 * Global Quarto API implementation
 */
export const quartoAPI: QuartoAPI = {
  markdownRegex: {
    extractYaml: readYamlFromMarkdown,
    partition: partitionMarkdown,
    getLanguages: languagesInMarkdown
  },

  mappedString: {
    fromString: asMappedString,
    fromFile: mappedStringFromFile,
    normalizeNewlines: mappedNormalizeNewlines
  }
};