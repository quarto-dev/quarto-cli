// src/core/quarto-api.ts

// Import types from quarto-cli, not quarto-types
import { MappedString } from "./lib/text-types.ts";
import { Metadata } from "../config/types.ts";
import { PartitionedMarkdown } from "./pandoc/types.ts";
import type {
  JupyterNotebook,
  JupyterToMarkdownOptions,
  JupyterToMarkdownResult,
  JupyterWidgetDependencies,
} from "./jupyter/types.ts";
import type {
  JupyterNotebookAssetPaths,
} from "./jupyter/jupyter.ts";
import type { PandocIncludes } from "../execute/types.ts";

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

  /**
   * Jupyter notebook integration utilities
   */
  jupyter: {
    /**
     * Create asset paths for Jupyter notebook output
     *
     * @param input - Input file path
     * @param to - Output format (optional)
     * @returns Asset paths for files, figures, and supporting directories
     */
    assets: (input: string, to?: string) => JupyterNotebookAssetPaths;

    /**
     * Convert a Jupyter notebook to markdown
     *
     * @param nb - Jupyter notebook to convert
     * @param options - Conversion options
     * @returns Converted markdown with cell outputs and dependencies
     */
    toMarkdown: (
      nb: JupyterNotebook,
      options: JupyterToMarkdownOptions
    ) => Promise<JupyterToMarkdownResult>;

    /**
     * Convert result dependencies to Pandoc includes
     *
     * @param tempDir - Temporary directory for includes
     * @param dependencies - Widget dependencies from execution result
     * @returns Pandoc includes structure
     */
    resultIncludes: (tempDir: string, dependencies?: JupyterWidgetDependencies) => PandocIncludes;

    /**
     * Extract engine dependencies from result dependencies
     *
     * @param dependencies - Widget dependencies from execution result
     * @returns Array of widget dependencies or undefined
     */
    resultEngineDependencies: (dependencies?: JupyterWidgetDependencies) => Array<JupyterWidgetDependencies> | undefined;

    /**
     * Check if a file is a Jupyter percent script
     *
     * @param file - File path to check
     * @param extensions - Optional array of extensions to check (default: ['.py', '.jl', '.r'])
     * @returns True if file is a Jupyter percent script
     */
    isPercentScript: (file: string, extensions?: string[]) => boolean;

    /**
     * Convert a Jupyter percent script to markdown
     *
     * @param file - Path to the percent script file
     * @returns Converted markdown content
     */
    percentScriptToMarkdown: (file: string) => string;
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
import { jupyterAssets, jupyterToMarkdown } from "../core/jupyter/jupyter.ts";
import {
  executeResultEngineDependencies,
  executeResultIncludes,
} from "../execute/jupyter/jupyter.ts";
import {
  isJupyterPercentScript,
  markdownFromJupyterPercentScript,
} from "../execute/jupyter/percent.ts";

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
  },

  jupyter: {
    assets: jupyterAssets,
    toMarkdown: jupyterToMarkdown,
    resultIncludes: (tempDir: string, dependencies?: JupyterWidgetDependencies) => {
      return executeResultIncludes(tempDir, dependencies) || {};
    },
    resultEngineDependencies: (dependencies?: JupyterWidgetDependencies) => {
      const result = executeResultEngineDependencies(dependencies);
      return result as Array<JupyterWidgetDependencies> | undefined;
    },
    isPercentScript: isJupyterPercentScript,
    percentScriptToMarkdown: markdownFromJupyterPercentScript
  }
};