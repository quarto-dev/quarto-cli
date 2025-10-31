// src/core/quarto-api.ts

// Import types from quarto-cli, not quarto-types
import { MappedString } from "./lib/text-types.ts";
import { Format, Metadata, FormatPandoc } from "../config/types.ts";
import { PartitionedMarkdown } from "./pandoc/types.ts";
import type { EngineProjectContext } from "../project/types.ts";
import type {
  JupyterNotebook,
  JupyterToMarkdownOptions,
  JupyterToMarkdownResult,
  JupyterWidgetDependencies,
  JupyterKernelspec,
  JupyterCapabilities,
} from "./jupyter/types.ts";
import {
  isJupyterNotebook,
  jupyterAssets,
  jupyterToMarkdown,
  jupyterKernelspecFromMarkdown,
  quartoMdToJupyter,
  jupyterFromJSON,
  kJupyterNotebookExtensions,
} from "./jupyter/jupyter.ts";
import {
  markdownFromNotebookFile,
  markdownFromNotebookJSON,
  jupyterNotebookFiltered,
} from "./jupyter/jupyter-filters.ts";
import {
  includesForJupyterWidgetDependencies,
} from "./jupyter/widgets.ts";
import {
  pythonExec,
} from "./jupyter/exec.ts";
import {
  jupyterCapabilities,
} from "./jupyter/capabilities.ts";
import {
  jupyterCapabilitiesMessage,
  jupyterInstallationMessage,
  jupyterUnactivatedEnvMessage,
  pythonInstallationMessage,
} from "./jupyter/jupyter-shared.ts";
import type {
  JupyterNotebookAssetPaths,
} from "./jupyter/jupyter.ts";
import type { PandocIncludes, PostProcessOptions } from "../execute/types.ts";
import {
  isJupyterPercentScript,
  markdownFromJupyterPercentScript,
} from "../execute/jupyter/percent.ts";
import { runExternalPreviewServer } from "../preview/preview-server.ts";
import type { PreviewServer } from "../preview/preview-server.ts";
import { isQmdFile } from "../execute/qmd.ts";
import { postProcessRestorePreservedHtml } from "../execute/engine-shared.ts";
import {
  executeResultIncludes,
  executeResultEngineDependencies,
} from "../execute/jupyter/jupyter.ts";

/**
 * Preview server interface
 */
export type { PreviewServer };

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
    // 1. Notebook Detection & Introspection
    isJupyterNotebook: (file: string) => boolean;
    isPercentScript: (file: string, extensions?: string[]) => boolean;
    notebookExtensions: string[];
    kernelspecFromMarkdown: (markdown: string, project?: EngineProjectContext) => Promise<[JupyterKernelspec, Metadata]>;
    fromJSON: (nbJson: string) => JupyterNotebook;

    // 2. Notebook Conversion
    toMarkdown: (
      nb: JupyterNotebook,
      options: JupyterToMarkdownOptions
    ) => Promise<JupyterToMarkdownResult>;
    markdownFromNotebookFile: (file: string, format?: Format) => Promise<string>;
    markdownFromNotebookJSON: (nb: JupyterNotebook) => string;
    percentScriptToMarkdown: (file: string) => string;
    quartoMdToJupyter: (markdown: string, includeIds: boolean, project?: EngineProjectContext) => Promise<JupyterNotebook>;

    // 3. Notebook Processing & Assets
    notebookFiltered: (input: string, filters: string[]) => Promise<string>;
    assets: (input: string, to?: string) => JupyterNotebookAssetPaths;
    widgetDependencyIncludes: (deps: JupyterWidgetDependencies[], tempDir: string) => { inHeader?: string; afterBody?: string };
    resultIncludes: (tempDir: string, dependencies?: JupyterWidgetDependencies) => PandocIncludes;
    resultEngineDependencies: (dependencies?: JupyterWidgetDependencies) => Array<JupyterWidgetDependencies> | undefined;

    // 4. Runtime & Environment
    pythonExec: (kernelspec?: JupyterKernelspec) => Promise<string[]>;
    capabilities: (kernelspec?: JupyterKernelspec) => Promise<JupyterCapabilities | undefined>;
    capabilitiesMessage: (caps: JupyterCapabilities, indent?: string) => Promise<string>;
    installationMessage: (caps: JupyterCapabilities) => string;
    unactivatedEnvMessage: (caps: JupyterCapabilities) => string | undefined;
    pythonInstallationMessage: () => string;
  };

  /**
   * Format detection utilities
   */
  format: {
    isHtmlCompatible: (format: Format) => boolean;
    isIpynbOutput: (format: FormatPandoc) => boolean;
    isLatexOutput: (format: FormatPandoc) => boolean;
    isMarkdownOutput: (format: Format, flavors?: string[]) => boolean;
    isPresentationOutput: (format: FormatPandoc) => boolean;
    isHtmlDashboardOutput: (format?: string) => boolean;
    isServerShiny: (format?: Format) => boolean;
    isServerShinyPython: (format: Format, engine: string | undefined) => boolean;
  };

  /**
   * Path manipulation utilities
   */
  path: {
    absolute: (path: string | URL) => string;
    toForwardSlashes: (path: string) => string;
    runtime: (subdir?: string) => string;
    resource: (...parts: string[]) => string;
    dirAndStem: (file: string) => [string, string];
    isQmdFile: (file: string) => boolean;
  };

  /**
   * System and environment detection utilities
   */
  system: {
    isInteractiveSession: () => boolean;
    runningInCI: () => boolean;
    execProcess: (
      options: ExecProcessOptions,
      stdin?: string,
      mergeOutput?: "stderr>stdout" | "stdout>stderr",
      stderrFilter?: (output: string) => string,
      respectStreams?: boolean,
      timeout?: number
    ) => Promise<ProcessResult>;
    runExternalPreviewServer: (options: {
      cmd: string[];
      readyPattern: RegExp;
      env?: Record<string, string>;
      cwd?: string;
    }) => PreviewServer;
  };

  /**
   * Markdown processing utilities
   */
  markdown: {
    asYamlText: (metadata: Metadata) => string;
    breakQuartoMd: (src: string | MappedString, validate?: boolean, lenient?: boolean) => Promise<QuartoMdChunks>;
  };

  /**
   * Text processing utilities
   */
  text: {
    lines: (text: string) => string[];
    trimEmptyLines: (lines: string[], trim?: "leading" | "trailing" | "all") => string[];
    postProcessRestorePreservedHtml: (options: PostProcessOptions) => void;
  };

  /**
   * Cryptographic utilities
   */
  crypto: {
    md5Hash: (content: string) => string;
  };
}

// Create the implementation of the quartoAPI
import { readYamlFromMarkdown } from "../core/yaml.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";
import { languagesInMarkdown } from "../execute/engine-shared.ts";
import {
  asMappedString,
  mappedNormalizeNewlines,
  mappedLines,
  mappedIndexToLineCol,
} from "../core/lib/mapped-text.ts";
import { mappedStringFromFile } from "../core/mapped-text.ts";
import {
  isHtmlCompatible,
  isIpynbOutput,
  isLatexOutput,
  isMarkdownOutput,
  isPresentationOutput,
  isHtmlDashboardOutput,
} from "../config/format.ts";
import {
  normalizePath,
  pathWithForwardSlashes,
  dirAndStem,
} from "../core/path.ts";
import { quartoRuntimeDir } from "../core/appdirs.ts";
import { resourcePath } from "../core/resources.ts";
import { isInteractiveSession } from "../core/platform.ts";
import { runningInCI } from "../core/ci-info.ts";
import { isServerShiny, isServerShinyPython } from "../core/render.ts";
import { execProcess } from "../core/process.ts";
import type { ExecProcessOptions } from "../core/process.ts";
import type { ProcessResult } from "../core/process-types.ts";
import { asYamlText } from "../core/jupyter/jupyter-fixups.ts";
import { breakQuartoMd } from "../core/lib/break-quarto-md.ts";
import type { QuartoMdChunks, QuartoMdCell } from "../core/lib/break-quarto-md.ts";
import { lines, trimEmptyLines } from "../core/lib/text.ts";
import { md5HashSync } from "../core/hash.ts";

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
    normalizeNewlines: mappedNormalizeNewlines,
    splitLines: (str: MappedString, keepNewLines?: boolean) => {
      return mappedLines(str, keepNewLines);
    },
    indexToLineCol: (str: MappedString, offset: number) => {
      const fn = mappedIndexToLineCol(str);
      return fn(offset);
    },
  },

  jupyter: {
    // 1. Notebook Detection & Introspection
    isJupyterNotebook,
    isPercentScript: isJupyterPercentScript,
    notebookExtensions: kJupyterNotebookExtensions,
    kernelspecFromMarkdown: jupyterKernelspecFromMarkdown,
    fromJSON: jupyterFromJSON,

    // 2. Notebook Conversion
    toMarkdown: jupyterToMarkdown,
    markdownFromNotebookFile,
    markdownFromNotebookJSON,
    percentScriptToMarkdown: markdownFromJupyterPercentScript,
    quartoMdToJupyter,

    // 3. Notebook Processing & Assets
    notebookFiltered: jupyterNotebookFiltered,
    assets: jupyterAssets,
    widgetDependencyIncludes: includesForJupyterWidgetDependencies,
    resultIncludes: (tempDir: string, dependencies?: JupyterWidgetDependencies) => {
      return executeResultIncludes(tempDir, dependencies) || {};
    },
    resultEngineDependencies: (dependencies?: JupyterWidgetDependencies) => {
      const result = executeResultEngineDependencies(dependencies);
      return result as Array<JupyterWidgetDependencies> | undefined;
    },

    // 4. Runtime & Environment
    pythonExec,
    capabilities: jupyterCapabilities,
    capabilitiesMessage: jupyterCapabilitiesMessage,
    installationMessage: jupyterInstallationMessage,
    unactivatedEnvMessage: jupyterUnactivatedEnvMessage,
    pythonInstallationMessage,
  },

  format: {
    isHtmlCompatible,
    isIpynbOutput,
    isLatexOutput,
    isMarkdownOutput,
    isPresentationOutput,
    isHtmlDashboardOutput: (format?: string) => !!isHtmlDashboardOutput(format),
    isServerShiny,
    isServerShinyPython,
  },

  path: {
    absolute: normalizePath,
    toForwardSlashes: pathWithForwardSlashes,
    runtime: quartoRuntimeDir,
    resource: (...parts: string[]) => {
      if (parts.length === 0) {
        return resourcePath();
      } else if (parts.length === 1) {
        return resourcePath(parts[0]);
      } else {
        // Join multiple parts with the first one
        const joined = parts.join("/");
        return resourcePath(joined);
      }
    },
    dirAndStem,
    isQmdFile,
  },

  system: {
    isInteractiveSession,
    runningInCI,
    execProcess,
    runExternalPreviewServer,
  },

  markdown: {
    asYamlText,
    breakQuartoMd,
  },

  text: {
    lines,
    trimEmptyLines,
    postProcessRestorePreservedHtml,
  },

  crypto: {
    md5Hash: md5HashSync,
  }
};