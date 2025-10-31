/*
 * quarto-api.d.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { MappedString } from "./text-types.ts";
import { Metadata } from "./metadata-types.ts";
import { PartitionedMarkdown } from "./execution-engine.ts";
import type {
  FormatPandoc,
  JupyterCapabilities,
  JupyterKernelspec,
  JupyterNotebook,
  JupyterNotebookAssetPaths,
  JupyterToMarkdownOptions,
  JupyterToMarkdownResult,
  JupyterWidgetDependencies,
} from "./jupyter-types.ts";
import { PandocIncludes, PostProcessOptions } from "./execution-engine.ts";
import { Format } from "./metadata-types.ts";
import { EngineProjectContext } from "./project-context.ts";

/**
 * Process execution result
 */
export interface ProcessResult {
  success: boolean;
  code: number;
  stdout?: string;
  stderr?: string;
}

/**
 * Process execution options
 */
export type ExecProcessOptions = {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdout?: "piped" | "inherit" | "null";
  stderr?: "piped" | "inherit" | "null";
  stdin?: "piped" | "inherit" | "null";
};

/**
 * Cell type from breaking Quarto markdown
 */
export interface QuartoMdCell {
  id?: string;
  cell_type: { language: string } | "markdown" | "raw";
  options?: Record<string, unknown>;
  source: MappedString;
  sourceVerbatim: MappedString;
  sourceWithYaml?: MappedString;
  sourceOffset: number;
  sourceStartLine: number;
  cellStartLine: number;
}

/**
 * Result from breaking Quarto markdown
 */
export interface QuartoMdChunks {
  cells: QuartoMdCell[];
}

/**
 * Preview server interface
 */
export interface PreviewServer {
  /** Start the server and return the URL to browse to */
  start: () => Promise<string | undefined>;
  /** Run the server (blocking) */
  serve: () => Promise<void>;
  /** Stop the server */
  stop: () => Promise<void>;
}

/**
 * Temporary context for managing temporary files and directories
 */
export interface TempContext {
  /** Create a temporary directory and return its path */
  createDir: () => string;
  /** Clean up all temporary resources */
  cleanup: () => void;
  /** Register a cleanup handler */
  onCleanup: (handler: VoidFunction) => void;
}

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
    indexToLineCol: (
      str: MappedString,
      offset: number,
    ) => { line: number; column: number };
  };

  /**
   * Jupyter notebook integration utilities
   */
  jupyter: {
    // 1. Notebook Detection & Introspection

    /**
     * Check if a file is a Jupyter notebook
     *
     * @param file - File path to check
     * @returns True if file is a Jupyter notebook (.ipynb)
     */
    isJupyterNotebook: (file: string) => boolean;

    /**
     * Check if a file is a Jupyter percent script
     *
     * @param file - File path to check
     * @param extensions - Optional array of extensions to check (default: ['.py', '.jl', '.r'])
     * @returns True if file is a Jupyter percent script
     */
    isPercentScript: (file: string, extensions?: string[]) => boolean;

    /**
     * List of Jupyter notebook file extensions
     */
    notebookExtensions: string[];

    /**
     * Extract kernelspec from markdown content
     *
     * @param markdown - Markdown content with YAML frontmatter
     * @returns Extracted kernelspec or undefined if not found
     */
    kernelspecFromMarkdown: (markdown: string) => JupyterKernelspec | undefined;

    /**
     * Convert JSON string to Jupyter notebook
     *
     * @param nbJson - JSON string containing notebook data
     * @returns Parsed Jupyter notebook object
     */
    fromJSON: (nbJson: string) => JupyterNotebook;

    // 2. Notebook Conversion

    /**
     * Convert a Jupyter notebook to markdown
     *
     * @param nb - Jupyter notebook to convert
     * @param options - Conversion options
     * @returns Converted markdown with cell outputs and dependencies
     */
    toMarkdown: (
      nb: JupyterNotebook,
      options: JupyterToMarkdownOptions,
    ) => Promise<JupyterToMarkdownResult>;

    /**
     * Convert Jupyter notebook file to markdown
     *
     * @param file - Path to notebook file
     * @param format - Optional format to use for conversion
     * @returns Markdown content extracted from notebook
     */
    markdownFromNotebookFile: (file: string, format?: Format) => string;

    /**
     * Convert Jupyter notebook JSON to markdown
     *
     * @param nbJson - Notebook JSON string
     * @returns Markdown content extracted from notebook
     */
    markdownFromNotebookJSON: (nbJson: string) => string;

    /**
     * Convert a Jupyter percent script to markdown
     *
     * @param file - Path to the percent script file
     * @returns Converted markdown content
     */
    percentScriptToMarkdown: (file: string) => string;

    /**
     * Convert Quarto markdown to Jupyter notebook
     *
     * @param markdown - Markdown content with YAML frontmatter
     * @param includeIds - Whether to include cell IDs
     * @param project - Optional project context for config merging
     * @returns Promise resolving to Jupyter notebook generated from markdown
     */
    quartoMdToJupyter: (
      markdown: string,
      includeIds: boolean,
      project?: EngineProjectContext,
    ) => Promise<JupyterNotebook>;

    // 3. Notebook Processing & Assets

    /**
     * Apply filters to a Jupyter notebook
     *
     * @param nb - Jupyter notebook to filter
     * @param filters - Array of filter strings to apply
     * @returns Filtered notebook
     */
    notebookFiltered: (
      nb: JupyterNotebook,
      filters: string[],
    ) => JupyterNotebook;

    /**
     * Create asset paths for Jupyter notebook output
     *
     * @param input - Input file path
     * @param to - Output format (optional)
     * @returns Asset paths for files, figures, and supporting directories
     */
    assets: (input: string, to?: string) => JupyterNotebookAssetPaths;

    /**
     * Generate Pandoc includes for Jupyter widget dependencies
     *
     * @param deps - Widget dependencies
     * @param tempDir - Temporary directory for includes
     * @returns Pandoc includes structure
     */
    widgetDependencyIncludes: (
      deps: JupyterWidgetDependencies,
      tempDir: string,
    ) => PandocIncludes;

    /**
     * Convert result dependencies to Pandoc includes
     *
     * @param tempDir - Temporary directory for includes
     * @param dependencies - Widget dependencies from execution result
     * @returns Pandoc includes structure
     */
    resultIncludes: (
      tempDir: string,
      dependencies?: JupyterWidgetDependencies,
    ) => PandocIncludes;

    /**
     * Extract engine dependencies from result dependencies
     *
     * @param dependencies - Widget dependencies from execution result
     * @returns Array of widget dependencies or undefined
     */
    resultEngineDependencies: (
      dependencies?: JupyterWidgetDependencies,
    ) => Array<JupyterWidgetDependencies> | undefined;

    // 4. Runtime & Environment

    /**
     * Get Python executable command
     *
     * @param python - Optional Python executable override
     * @returns Promise resolving to array of command line arguments
     */
    pythonExec: (python?: string) => Promise<string[]>;

    /**
     * Get Jupyter capabilities
     *
     * @param python - Optional Python executable override
     * @param jupyter - Optional Jupyter executable override
     * @returns Promise resolving to Jupyter capabilities
     */
    capabilities: (
      python?: string,
      jupyter?: string,
    ) => Promise<JupyterCapabilities>;

    /**
     * Generate capabilities message
     *
     * @param caps - Jupyter capabilities
     * @param extraMessage - Optional additional message
     * @returns Formatted capabilities message
     */
    capabilitiesMessage: (
      caps: JupyterCapabilities,
      extraMessage?: string,
    ) => string;

    /**
     * Generate Jupyter installation message
     *
     * @param python - Python executable path
     * @returns Installation message
     */
    installationMessage: (python: string) => string;

    /**
     * Generate message about unactivated environment
     *
     * @returns Message about unactivated environment
     */
    unactivatedEnvMessage: () => string;

    /**
     * Generate message about Python installation
     *
     * @returns Message about Python installation
     */
    pythonInstallationMessage: () => string;
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

    /**
     * Check if format is a Shiny server document
     *
     * @param format - Optional format to check
     * @returns True if format has server: shiny
     */
    isServerShiny: (format?: Format) => boolean;

    /**
     * Check if format is a Python Shiny server document with Jupyter engine
     *
     * @param format - Format to check
     * @param engine - Execution engine name
     * @returns True if format is server: shiny with jupyter engine
     */
    isServerShinyPython: (
      format: Format,
      engine: string | undefined,
    ) => boolean;
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

    /**
     * Get platform-specific runtime directory for Quarto
     *
     * Returns the appropriate runtime/state directory based on platform:
     * - macOS: ~/Library/Caches/quarto/{subdir}
     * - Windows: %LOCALAPPDATA%/quarto/{subdir}
     * - Linux: $XDG_RUNTIME_DIR or ~/.local/share/quarto/{subdir}
     *
     * Automatically creates the directory if it doesn't exist.
     *
     * @param subdir - Optional subdirectory within the runtime directory
     * @returns Absolute path to the runtime directory
     */
    runtime: (subdir?: string) => string;

    /**
     * Get path to a Quarto resource file
     *
     * Returns the path to bundled resource files in Quarto's share directory.
     * Can accept multiple path segments that will be joined.
     *
     * @param parts - Path segments to join (e.g., "julia", "script.jl")
     * @returns Absolute path to the resource file
     */
    resource: (...parts: string[]) => string;

    /**
     * Split a file path into directory and stem (filename without extension)
     *
     * @param file - File path to split
     * @returns Tuple of [directory, filename stem]
     */
    dirAndStem: (file: string) => [string, string];

    /**
     * Check if a file is a Quarto markdown file (.qmd)
     *
     * @param file - File path to check
     * @returns True if file has .qmd extension
     */
    isQmdFile: (file: string) => boolean;

    /**
     * Get platform-specific user data directory for Quarto
     *
     * Returns the appropriate data directory based on platform:
     * - macOS: ~/Library/Application Support/quarto/{subdir}
     * - Windows: %LOCALAPPDATA%/quarto/{subdir} (or %APPDATA% if roaming)
     * - Linux: $XDG_DATA_HOME/quarto/{subdir} or ~/.local/share/quarto/{subdir}
     *
     * Automatically creates the directory if it doesn't exist.
     *
     * @param subdir - Optional subdirectory within the data directory
     * @param roaming - Optional flag for Windows roaming profile (default: false)
     * @returns Absolute path to the data directory
     */
    dataDir: (subdir?: string, roaming?: boolean) => string;
  };

  /**
   * System and environment detection utilities
   */
  system: {
    /**
     * Check if running in an interactive session
     *
     * Detects if Quarto is running in an interactive environment such as:
     * - RStudio IDE
     * - VS Code output channel
     * - Interactive terminal (TTY)
     *
     * @returns True if running in an interactive environment
     */
    isInteractiveSession: () => boolean;

    /**
     * Check if running in a CI/CD environment
     *
     * Detects if Quarto is running in a continuous integration environment by checking
     * for common CI environment variables across 40+ CI/CD platforms including:
     * - GitHub Actions
     * - GitLab CI
     * - Jenkins
     * - CircleCI
     * - Travis CI
     * - And many more
     *
     * @returns True if running in a CI/CD environment
     */
    runningInCI: () => boolean;

    /**
     * Execute an external process
     *
     * @param options - Process execution options
     * @param stdin - Optional stdin content
     * @param mergeOutput - Optional output stream merging
     * @param stderrFilter - Optional stderr filter function
     * @param respectStreams - Optional flag to respect stream separation
     * @param timeout - Optional timeout in milliseconds
     * @returns Promise resolving to process result
     */
    execProcess: (
      options: ExecProcessOptions,
      stdin?: string,
      mergeOutput?: "stderr>stdout" | "stdout>stderr",
      stderrFilter?: (output: string) => string,
      respectStreams?: boolean,
      timeout?: number,
    ) => Promise<ProcessResult>;

    /**
     * Run an external preview server
     *
     * @param options - Server options including command and ready pattern
     * @returns PreviewServer instance for managing the server lifecycle
     */
    runExternalPreviewServer: (options: {
      cmd: string[];
      readyPattern: RegExp;
      env?: Record<string, string>;
      cwd?: string;
    }) => PreviewServer;

    /**
     * Register a cleanup handler to run on process exit
     *
     * @param handler - Function to run on cleanup (can be async)
     */
    onCleanup: (handler: () => void | Promise<void>) => void;

    /**
     * Get global temporary context for managing temporary files and directories
     *
     * @returns Global TempContext instance
     */
    tempContext: () => TempContext;
  };

  /**
   * Markdown processing utilities
   */
  markdown: {
    /**
     * Convert metadata object to YAML text
     *
     * @param metadata - Metadata object to convert
     * @returns YAML formatted string
     */
    asYamlText: (metadata: Metadata) => string;

    /**
     * Break Quarto markdown into cells
     *
     * @param src - Markdown string or MappedString
     * @param validate - Whether to validate cells (default: false)
     * @param lenient - Whether to use lenient parsing (default: false)
     * @returns Promise resolving to chunks with cells
     */
    breakQuartoMd: (
      src: string | MappedString,
      validate?: boolean,
      lenient?: boolean,
    ) => Promise<QuartoMdChunks>;
  };

  /**
   * Text processing utilities
   */
  text: {
    /**
     * Split text into lines
     *
     * @param text - Text to split
     * @returns Array of lines
     */
    lines: (text: string) => string[];

    /**
     * Trim empty lines from array
     *
     * @param lines - Array of lines
     * @param trim - Which empty lines to trim (default: "all")
     * @returns Trimmed array of lines
     */
    trimEmptyLines: (
      lines: string[],
      trim?: "leading" | "trailing" | "all",
    ) => string[];

    /**
     * Restore preserved HTML in post-processing
     *
     * @param options - Post-processing options including output path and preserve map
     */
    postProcessRestorePreservedHtml: (options: PostProcessOptions) => void;

    /**
     * Convert line/column position to character index
     *
     * @param text - Text to search in
     * @returns Function that converts position to index
     */
    lineColToIndex: (
      text: string,
    ) => (position: { line: number; column: number }) => number;

    /**
     * Create a handler for executing inline code
     *
     * @param language - Programming language identifier
     * @param exec - Function to execute code expression
     * @returns Handler function that processes code strings
     */
    executeInlineCodeHandler: (
      language: string,
      exec: (expr: string) => string | undefined,
    ) => (code: string) => string;
  };

  /**
   * Cryptographic utilities
   */
  crypto: {
    /**
     * Generate MD5 hash of content
     *
     * @param content - String content to hash
     * @returns MD5 hash as hexadecimal string
     */
    md5Hash: (content: string) => string;
  };
}

/**
 * Global Quarto API object
 */
export declare const quartoAPI: QuartoAPI;
