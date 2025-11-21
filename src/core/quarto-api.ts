// src/core/quarto-api.ts

// Import types from quarto-cli, not quarto-types
import { MappedString } from "./lib/text-types.ts";
import { Format, FormatPandoc, Metadata } from "../config/types.ts";
import { PartitionedMarkdown } from "./pandoc/types.ts";
import type { EngineProjectContext } from "../project/types.ts";
import type {
  JupyterCapabilities,
  JupyterKernelspec,
  JupyterNotebook,
  JupyterToMarkdownOptions,
  JupyterToMarkdownResult,
  JupyterWidgetDependencies,
} from "./jupyter/types.ts";
import {
  isJupyterNotebook,
  jupyterAssets,
  jupyterFromJSON,
  jupyterKernelspecFromMarkdown,
  jupyterToMarkdown,
  kJupyterNotebookExtensions,
  quartoMdToJupyter,
} from "./jupyter/jupyter.ts";
import {
  jupyterNotebookFiltered,
  markdownFromNotebookFile,
  markdownFromNotebookJSON,
} from "./jupyter/jupyter-filters.ts";
import { includesForJupyterWidgetDependencies } from "./jupyter/widgets.ts";
import { pythonExec } from "./jupyter/exec.ts";
import { jupyterCapabilities } from "./jupyter/capabilities.ts";
import { jupyterKernelspecForLanguage } from "./jupyter/kernels.ts";
import {
  jupyterCapabilitiesJson,
  jupyterCapabilitiesMessage,
  jupyterInstallationMessage,
  jupyterUnactivatedEnvMessage,
  pythonInstallationMessage,
} from "./jupyter/jupyter-shared.ts";
import type { JupyterNotebookAssetPaths } from "./jupyter/jupyter.ts";
import type { PandocIncludes, PostProcessOptions } from "../execute/types.ts";
import {
  isJupyterPercentScript,
  markdownFromJupyterPercentScript,
} from "../execute/jupyter/percent.ts";
import { runExternalPreviewServer } from "../preview/preview-server.ts";
import type { PreviewServer } from "../preview/preview-server.ts";
import { isQmdFile } from "../execute/qmd.ts";
import { postProcessRestorePreservedHtml } from "../execute/engine-shared.ts";
import { onCleanup } from "./cleanup.ts";
import { inputFilesDir, isServerShiny, isServerShinyPython } from "./render.ts";
import { quartoDataDir } from "./appdirs.ts";
import {
  executeResultEngineDependencies,
  executeResultIncludes,
} from "../execute/jupyter/jupyter.ts";
import { completeMessage, withSpinner } from "./console.ts";
import { checkRender } from "../command/check/check-render.ts";
import type { RenderServiceWithLifetime } from "../command/render/types.ts";
import type { LogMessageOptions } from "./log.ts";
import * as log from "../deno_ral/log.ts";

export interface QuartoAPI {
  markdownRegex: {
    extractYaml: (markdown: string) => Metadata;
    partition: (markdown: string) => PartitionedMarkdown;
    getLanguages: (markdown: string) => Set<string>;
    breakQuartoMd: (
      src: string | MappedString,
      validate?: boolean,
      lenient?: boolean,
    ) => Promise<QuartoMdChunks>;
  };
  mappedString: {
    fromString: (text: string, fileName?: string) => MappedString;
    fromFile: (path: string) => MappedString;
    normalizeNewlines: (markdown: MappedString) => MappedString;
    splitLines: (str: MappedString, keepNewLines?: boolean) => MappedString[];
    indexToLineCol: (
      str: MappedString,
      offset: number,
    ) => { line: number; column: number };
  };
  jupyter: {
    isJupyterNotebook: (file: string) => boolean;
    isPercentScript: (file: string, extensions?: string[]) => boolean;
    notebookExtensions: string[];
    kernelspecFromMarkdown: (
      markdown: string,
      project?: EngineProjectContext,
    ) => Promise<[JupyterKernelspec, Metadata]>;
    kernelspecForLanguage: (
      language: string,
    ) => Promise<JupyterKernelspec | undefined>;
    fromJSON: (nbJson: string) => JupyterNotebook;
    toMarkdown: (
      nb: JupyterNotebook,
      options: JupyterToMarkdownOptions,
    ) => Promise<JupyterToMarkdownResult>;
    markdownFromNotebookFile: (
      file: string,
      format?: Format,
    ) => Promise<string>;
    markdownFromNotebookJSON: (nb: JupyterNotebook) => string;
    percentScriptToMarkdown: (file: string) => string;
    quartoMdToJupyter: (
      markdown: string,
      includeIds: boolean,
      project?: EngineProjectContext,
    ) => Promise<JupyterNotebook>;
    notebookFiltered: (input: string, filters: string[]) => Promise<string>;
    assets: (input: string, to?: string) => JupyterNotebookAssetPaths;
    widgetDependencyIncludes: (
      deps: JupyterWidgetDependencies[],
      tempDir: string,
    ) => { inHeader?: string; afterBody?: string };
    resultIncludes: (
      tempDir: string,
      dependencies?: JupyterWidgetDependencies,
    ) => PandocIncludes;
    resultEngineDependencies: (
      dependencies?: JupyterWidgetDependencies,
    ) => Array<JupyterWidgetDependencies> | undefined;
    pythonExec: (kernelspec?: JupyterKernelspec) => Promise<string[]>;
    capabilities: (
      kernelspec?: JupyterKernelspec,
    ) => Promise<JupyterCapabilities | undefined>;
    capabilitiesMessage: (
      caps: JupyterCapabilities,
      indent?: string,
    ) => Promise<string>;
    capabilitiesJson: (
      caps: JupyterCapabilities,
    ) => Promise<JupyterCapabilities & { kernels: JupyterKernelspec[] }>;
    installationMessage: (caps: JupyterCapabilities, indent?: string) => string;
    unactivatedEnvMessage: (
      caps: JupyterCapabilities,
      indent?: string,
    ) => string | undefined;
    pythonInstallationMessage: (indent?: string) => string;
  };
  format: {
    isHtmlCompatible: (format: Format) => boolean;
    isIpynbOutput: (format: FormatPandoc) => boolean;
    isLatexOutput: (format: FormatPandoc) => boolean;
    isMarkdownOutput: (format: Format, flavors?: string[]) => boolean;
    isPresentationOutput: (format: FormatPandoc) => boolean;
    isHtmlDashboardOutput: (format?: string) => boolean;
    isServerShiny: (format?: Format) => boolean;
    isServerShinyPython: (
      format: Format,
      engine: string | undefined,
    ) => boolean;
  };
  path: {
    absolute: (path: string | URL) => string;
    toForwardSlashes: (path: string) => string;
    runtime: (subdir?: string) => string;
    resource: (...parts: string[]) => string;
    dirAndStem: (file: string) => [string, string];
    isQmdFile: (file: string) => boolean;
    inputFilesDir: (input: string) => string;
    dataDir: (subdir?: string, roaming?: boolean) => string;
  };
  system: {
    isInteractiveSession: () => boolean;
    runningInCI: () => boolean;
    execProcess: (
      options: ExecProcessOptions,
      stdin?: string,
      mergeOutput?: "stderr>stdout" | "stdout>stderr",
      stderrFilter?: (output: string) => string,
      respectStreams?: boolean,
      timeout?: number,
    ) => Promise<ProcessResult>;
    runExternalPreviewServer: (options: {
      cmd: string[];
      readyPattern: RegExp;
      env?: Record<string, string>;
      cwd?: string;
    }) => PreviewServer;
    onCleanup: (handler: () => void | Promise<void>) => void;
    tempContext: () => TempContext;
    checkRender: (options: {
      content: string;
      language: string;
      services: RenderServiceWithLifetime;
    }) => Promise<{ success: boolean; error?: Error }>;
  };
  text: {
    lines: (text: string) => string[];
    trimEmptyLines: (
      lines: string[],
      trim?: "leading" | "trailing" | "all",
    ) => string[];
    postProcessRestorePreservedHtml: (options: PostProcessOptions) => void;
    lineColToIndex: (
      text: string,
    ) => (position: { line: number; column: number }) => number;
    executeInlineCodeHandler: (
      language: string,
      exec: (expr: string) => string | undefined,
    ) => (code: string) => string;
    asYamlText: (metadata: Metadata) => string;
  };
  console: {
    withSpinner: <T>(
      options: {
        message: string | (() => string);
        doneMessage?: string | boolean;
      },
      fn: () => Promise<T>,
    ) => Promise<T>;
    completeMessage: (message: string) => void;
    info: (message: string, options?: LogMessageOptions) => void;
    warning: (message: string, options?: LogMessageOptions) => void;
    error: (message: string, options?: LogMessageOptions) => void;
  };
  crypto: {
    md5Hash: (content: string) => string;
  };
}

// Create the implementation of the quartoAPI
import { readYamlFromMarkdown } from "./yaml.ts";
import { partitionMarkdown } from "./pandoc/pandoc-partition.ts";
import { languagesInMarkdown } from "../execute/engine-shared.ts";
import {
  asMappedString,
  mappedIndexToLineCol,
  mappedLines,
  mappedNormalizeNewlines,
} from "./lib/mapped-text.ts";
import { mappedStringFromFile } from "./mapped-text.ts";
import {
  isHtmlCompatible,
  isHtmlDashboardOutput,
  isIpynbOutput,
  isLatexOutput,
  isMarkdownOutput,
  isPresentationOutput,
} from "../config/format.ts";
import { dirAndStem, normalizePath, pathWithForwardSlashes } from "./path.ts";
import { quartoRuntimeDir } from "./appdirs.ts";
import { resourcePath } from "./resources.ts";
import { isInteractiveSession } from "./platform.ts";
import { runningInCI } from "./ci-info.ts";
import { execProcess } from "./process.ts";
import type { ExecProcessOptions } from "./process.ts";
import type { ProcessResult } from "./process-types.ts";
import { asYamlText } from "./jupyter/jupyter-fixups.ts";
import { breakQuartoMd } from "./lib/break-quarto-md.ts";
import type { QuartoMdCell, QuartoMdChunks } from "./lib/break-quarto-md.ts";
import { lineColToIndex, lines, trimEmptyLines } from "./lib/text.ts";
import { md5HashSync } from "./hash.ts";
import { executeInlineCodeHandler } from "./execute-inline.ts";
import { globalTempContext } from "./temp.ts";
import type { TempContext } from "./temp-types.ts";

/**
 * Global Quarto API implementation
 */
export const quartoAPI: QuartoAPI = {
  markdownRegex: {
    extractYaml: readYamlFromMarkdown,
    partition: partitionMarkdown,
    getLanguages: languagesInMarkdown,
    breakQuartoMd,
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
    kernelspecForLanguage: jupyterKernelspecForLanguage,
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
    resultIncludes: (
      tempDir: string,
      dependencies?: JupyterWidgetDependencies,
    ) => {
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
    capabilitiesJson: jupyterCapabilitiesJson,
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
    inputFilesDir,
    dataDir: quartoDataDir,
  },

  system: {
    isInteractiveSession,
    runningInCI,
    execProcess,
    runExternalPreviewServer,
    onCleanup,
    tempContext: globalTempContext,
    checkRender,
  },

  text: {
    lines,
    trimEmptyLines,
    postProcessRestorePreservedHtml,
    lineColToIndex,
    executeInlineCodeHandler,
    asYamlText,
  },

  console: {
    withSpinner,
    completeMessage,
    info: (message: string, options?: LogMessageOptions) =>
      log.info(message, options),
    warning: (message: string, options?: LogMessageOptions) =>
      log.warning(message, options),
    error: (message: string, options?: LogMessageOptions) =>
      log.error(message, options),
  },

  crypto: {
    md5Hash: md5HashSync,
  },
};
