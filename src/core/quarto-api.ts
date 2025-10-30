// src/core/quarto-api.ts

// Import types from quarto-cli, not quarto-types
import { MappedString } from "./lib/text-types.ts";
import { Format, Metadata, FormatPandoc } from "../config/types.ts";
import { PartitionedMarkdown } from "./pandoc/types.ts";
import type { ProjectContext } from "../project/types.ts";
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
import type { PandocIncludes } from "../execute/types.ts";
import {
  isJupyterPercentScript,
  markdownFromJupyterPercentScript,
} from "../execute/jupyter/percent.ts";
import {
  executeResultIncludes,
  executeResultEngineDependencies,
} from "../execute/jupyter/jupyter.ts";

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
    notebookExtensions: string[];
    isJupyterNotebook: (file: string) => boolean;
    fromJSON: (nbJson: string) => JupyterNotebook;
    kernelspecFromMarkdown: (markdown: string, project?: ProjectContext) => Promise<[JupyterKernelspec, Metadata]>;
    markdownFromNotebookFile: (file: string, format?: Format) => Promise<string>;
    markdownFromNotebookJSON: (nb: JupyterNotebook) => string;
    quartoMdToJupyter: (markdown: string, includeIds: boolean, project?: ProjectContext) => Promise<JupyterNotebook>;
    notebookFiltered: (input: string, filters: string[]) => Promise<string>;
    widgetDependencyIncludes: (deps: JupyterWidgetDependencies[], tempDir: string) => { inHeader?: string; afterBody?: string };
    pythonExec: (kernelspec?: JupyterKernelspec) => Promise<string[]>;
    capabilities: (kernelspec?: JupyterKernelspec) => Promise<JupyterCapabilities | undefined>;
    capabilitiesMessage: (caps: JupyterCapabilities, indent?: string) => Promise<string>;
    installationMessage: (caps: JupyterCapabilities) => string;
    unactivatedEnvMessage: (caps: JupyterCapabilities) => string | undefined;
    pythonInstallationMessage: () => string;
    assets: (input: string, to?: string) => JupyterNotebookAssetPaths;
    toMarkdown: (
      nb: JupyterNotebook,
      options: JupyterToMarkdownOptions
    ) => Promise<JupyterToMarkdownResult>;
    resultIncludes: (tempDir: string, dependencies?: JupyterWidgetDependencies) => PandocIncludes;
    resultEngineDependencies: (dependencies?: JupyterWidgetDependencies) => Array<JupyterWidgetDependencies> | undefined;
    isPercentScript: (file: string, extensions?: string[]) => boolean;
    percentScriptToMarkdown: (file: string) => string;
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
  };

  /**
   * Path manipulation utilities
   */
  path: {
    absolute: (path: string | URL) => string;
    toForwardSlashes: (path: string) => string;
    runtime: (subdir?: string) => string;
    resource: (...parts: string[]) => string;
  };

  /**
   * System and environment detection utilities
   */
  system: {
    isInteractiveSession: () => boolean;
    runningInCI: () => boolean;
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
} from "../core/path.ts";
import { quartoRuntimeDir } from "../core/appdirs.ts";
import { resourcePath } from "../core/resources.ts";
import { isInteractiveSession } from "../core/platform.ts";
import { runningInCI } from "../core/ci-info.ts";

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
    notebookExtensions: kJupyterNotebookExtensions,
    isJupyterNotebook,
    fromJSON: jupyterFromJSON,
    kernelspecFromMarkdown: jupyterKernelspecFromMarkdown,
    markdownFromNotebookFile,
    markdownFromNotebookJSON,
    quartoMdToJupyter,
    notebookFiltered: jupyterNotebookFiltered,
    widgetDependencyIncludes: includesForJupyterWidgetDependencies,
    pythonExec,
    capabilities: jupyterCapabilities,
    capabilitiesMessage: jupyterCapabilitiesMessage,
    installationMessage: jupyterInstallationMessage,
    unactivatedEnvMessage: jupyterUnactivatedEnvMessage,
    pythonInstallationMessage,
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
  },

  format: {
    isHtmlCompatible,
    isIpynbOutput,
    isLatexOutput,
    isMarkdownOutput,
    isPresentationOutput,
    isHtmlDashboardOutput: (format?: string) => !!isHtmlDashboardOutput(format),
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
  },

  system: {
    isInteractiveSession,
    runningInCI,
  }
};