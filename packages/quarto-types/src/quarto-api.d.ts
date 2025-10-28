/*
 * quarto-api.d.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { MappedString } from './text-types';
import { Metadata } from './metadata-types';
import { PartitionedMarkdown } from './execution-engine';
import type {
  JupyterNotebook,
  JupyterToMarkdownOptions,
  JupyterToMarkdownResult,
  JupyterNotebookAssetPaths,
  PandocIncludes,
  JupyterWidgetDependencies,
} from './jupyter-types';

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

    /**
     * Split a MappedString into lines
     *
     * @param str - MappedString to split
     * @param keepNewLines - Whether to keep newline characters (default: false)
     * @returns Array of MappedStrings, one per line
     */
    splitLines: (str: MappedString, keepNewLines?: boolean) => MappedString[];

    /**
     * Convert character offset to line/column coordinates
     *
     * @param str - MappedString to query
     * @param offset - Character offset to convert
     * @returns Line and column numbers (1-indexed)
     */
    indexToLineCol: (str: MappedString, offset: number) => { line: number; column: number };
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

  /**
   * Format detection utilities
   */
  format: {
    /**
     * Check if format is HTML compatible
     *
     * @param format - Format to check
     * @returns True if format is HTML compatible
     */
    isHtmlCompatible: (format: Format) => boolean;

    /**
     * Check if format is Jupyter notebook output
     *
     * @param format - Format pandoc options to check
     * @returns True if format is ipynb
     */
    isIpynbOutput: (format: FormatPandoc) => boolean;

    /**
     * Check if format is LaTeX output
     *
     * @param format - Format pandoc options to check
     * @returns True if format is LaTeX (pdf, latex, or beamer)
     */
    isLatexOutput: (format: FormatPandoc) => boolean;

    /**
     * Check if format is markdown output
     *
     * @param format - Format to check
     * @param flavors - Optional array of markdown flavors to check
     * @returns True if format is markdown
     */
    isMarkdownOutput: (format: Format, flavors?: string[]) => boolean;

    /**
     * Check if format is presentation output
     *
     * @param format - Format pandoc options to check
     * @returns True if format is a presentation format
     */
    isPresentationOutput: (format: FormatPandoc) => boolean;

    /**
     * Check if format is HTML dashboard output
     *
     * @param format - Optional format string to check
     * @returns True if format is a dashboard
     */
    isHtmlDashboardOutput: (format?: string) => boolean;
  };

  /**
   * Path manipulation utilities
   */
  path: {
    /**
     * Convert path to absolute form with platform-specific handling
     *
     * Handles URL to file path conversion, makes relative paths absolute,
     * normalizes the path, and uppercases Windows drive letters.
     *
     * @param path - Path string or URL to make absolute
     * @returns Absolute, normalized path with Windows-specific fixes
     */
    absolute: (path: string | URL) => string;

    /**
     * Convert path to use forward slashes
     *
     * @param path - Path with backslashes or forward slashes
     * @returns Path with only forward slashes
     */
    toForwardSlashes: (path: string) => string;
  };
}

/**
 * Global Quarto API object
 */
export declare const quartoAPI: QuartoAPI;