/*
 * quarto-api.d.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import type { MappedString } from "./text.ts";
import type { Metadata } from "./metadata.ts";
import type { Format } from "./format.ts";
import type { PartitionedMarkdown } from "./markdown.ts";
import type { EngineProjectContext } from "./project-context.ts";
import type {
  JupyterNotebook,
  JupyterToMarkdownOptions,
  JupyterToMarkdownResult,
  JupyterWidgetDependencies,
  JupyterKernelspec,
  JupyterCapabilities,
  JupyterNotebookAssetPaths,
  FormatPandoc,
} from "./jupyter.ts";
import type { PandocIncludes } from "./pandoc.ts";
import type { PostProcessOptions } from "./execution.ts";
import type {
  PreviewServer,
  ProcessResult,
  ExecProcessOptions,
  TempContext,
} from "./system.ts";
import type { LogMessageOptions, SpinnerOptions } from "./console.ts";
import type {
  CheckRenderOptions,
  CheckRenderResult,
} from "./check.ts";
import type { QuartoMdChunks, QuartoMdCell } from "./markdown.ts";

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
     * Find a Jupyter kernelspec that supports a given language
     *
     * @param language - Language to find kernel for (e.g., "python", "julia", "r")
     * @returns Promise resolving to matching kernelspec or undefined if not found
     */
    kernelspecForLanguage: (
      language: string,
    ) => Promise<JupyterKernelspec | undefined>;

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
     * Generate formatted capabilities message with version, path, jupyter version, and kernels
     *
     * @param caps - Jupyter capabilities
     * @param indent - Optional indentation string (default: "")
     * @returns Promise resolving to formatted capabilities message with indentation
     */
    capabilitiesMessage: (
      caps: JupyterCapabilities,
      indent?: string,
    ) => Promise<string>;

    /**
     * Generate capabilities with kernels list for JSON output
     *
     * Enriches capabilities with full kernels array for structured output.
     * Used by check command JSON output.
     *
     * @param caps - Jupyter capabilities
     * @returns Promise resolving to capabilities with kernels array
     */
    capabilitiesJson: (
      caps: JupyterCapabilities,
    ) => Promise<JupyterCapabilities & { kernels: JupyterKernelspec[] }>;

    /**
     * Generate Jupyter installation instructions
     *
     * @param caps - Jupyter capabilities (to determine conda vs pip)
     * @param indent - Optional indentation string (default: "")
     * @returns Installation message with appropriate package manager
     */
    installationMessage: (
      caps: JupyterCapabilities,
      indent?: string,
    ) => string;

    /**
     * Check for and generate warning about unactivated Python environments
     *
     * @param caps - Jupyter capabilities (to check if python is from venv)
     * @param indent - Optional indentation string (default: "")
     * @returns Warning message if unactivated env found, undefined otherwise
     */
    unactivatedEnvMessage: (
      caps: JupyterCapabilities,
      indent?: string,
    ) => string | undefined;

    /**
     * Generate Python installation instructions
     *
     * @param indent - Optional indentation string (default: "")
     * @returns Installation message
     */
    pythonInstallationMessage: (indent?: string) => string;
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
     * Get the standard supporting files directory name for an input file
     *
     * Returns the conventional `{stem}_files` directory name where Quarto
     * stores supporting resources (images, data files, etc.) for a document.
     *
     * @param input - Input file path
     * @returns Directory name in format `{stem}_files`
     * @example
     * ```typescript
     * inputFilesDir("/path/to/document.qmd") // returns "document_files"
     * ```
     */
    inputFilesDir: (input: string) => string;

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

    /**
     * Test-render a document for validation during check operations
     *
     * Creates a temporary file with the provided content, renders it with
     * appropriate engine settings, and returns success/failure status.
     * Used by checkInstallation implementations to verify engines work.
     *
     * @param options - Check render options with content and services
     * @returns Promise resolving to render result with success status
     */
    checkRender: (options: CheckRenderOptions) => Promise<CheckRenderResult>;
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

    /**
     * Convert metadata object to YAML text
     *
     * @param metadata - Metadata object to convert
     * @returns YAML formatted string
     */
    asYamlText: (metadata: Metadata) => string;
  };

  /**
   * Console and UI utilities
   */
  console: {
    /**
     * Execute an async operation with a spinner displayed in the console
     *
     * Shows a spinner with a message while the operation runs, then displays
     * a completion message when done.
     *
     * @param options - Spinner display options
     * @param fn - Async function to execute
     * @returns Promise resolving to the function's return value
     */
    withSpinner: <T>(
      options: SpinnerOptions,
      fn: () => Promise<T>,
    ) => Promise<T>;

    /**
     * Display a completion message in the console
     *
     * Shows a message with a checkmark indicator (or equivalent) to indicate
     * successful completion of an operation.
     *
     * @param message - Message to display
     */
    completeMessage: (message: string) => void;

    /**
     * Log an informational message to stderr
     *
     * Writes an info-level message to stderr using Quarto's custom logging handler.
     * Supports formatting options like indentation, bold text, and color control.
     *
     * @param message - Message to log
     * @param options - Optional formatting options
     */
    info: (message: string, options?: LogMessageOptions) => void;

    /**
     * Log a warning message to stderr
     *
     * Writes a warning-level message to stderr with yellow color and "WARNING:" prefix.
     * Uses Quarto's custom logging handler.
     *
     * @param message - Warning message to log
     * @param options - Optional formatting options
     */
    warning: (message: string, options?: LogMessageOptions) => void;

    /**
     * Log an error message to stderr
     *
     * Writes an error-level message to stderr with bright red color and "ERROR:" prefix.
     * Uses Quarto's custom logging handler.
     *
     * @param message - Error message to log
     * @param options - Optional formatting options
     */
    error: (message: string, options?: LogMessageOptions) => void;
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
