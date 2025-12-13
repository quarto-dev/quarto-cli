// src/core/api/types.ts

// Import types ONLY - no value imports to avoid circular dependencies
import type { MappedString } from "../lib/text-types.ts";
import type { Format, FormatPandoc, Metadata } from "../../config/types.ts";
import type { PartitionedMarkdown } from "../pandoc/types.ts";
import type { EngineProjectContext } from "../../project/types.ts";
import type {
  JupyterCapabilities,
  JupyterKernelspec,
  JupyterNotebook,
  JupyterToMarkdownOptions,
  JupyterToMarkdownResult,
  JupyterWidgetDependencies,
} from "../jupyter/types.ts";
import type { JupyterNotebookAssetPaths } from "../jupyter/jupyter.ts";
import type {
  PandocIncludes,
  PostProcessOptions,
} from "../../execute/types.ts";
import type { ExecProcessOptions } from "../process.ts";
import type { ProcessResult } from "../process-types.ts";
import type { PreviewServer } from "../../preview/preview-server.ts";
import type { RenderServiceWithLifetime } from "../../command/render/types.ts";
import type { LogMessageOptions } from "../log.ts";
import type { QuartoMdChunks } from "../lib/break-quarto-md.ts";
import type { TempContext } from "../temp-types.ts";

/**
 * Provider function type for lazy/eager initialization of namespaces
 */
export type ProviderFunction<T> = () => T;

/**
 * Markdown regex operations namespace
 */
export interface MarkdownRegexNamespace {
  extractYaml: (markdown: string) => Metadata;
  partition: (markdown: string) => PartitionedMarkdown;
  getLanguages: (markdown: string) => Set<string>;
  breakQuartoMd: (
    src: string | MappedString,
    validate?: boolean,
    lenient?: boolean,
  ) => Promise<QuartoMdChunks>;
}

/**
 * MappedString operations namespace
 */
export interface MappedStringNamespace {
  fromString: (text: string, fileName?: string) => MappedString;
  fromFile: (path: string) => MappedString;
  normalizeNewlines: (markdown: MappedString) => MappedString;
  splitLines: (str: MappedString, keepNewLines?: boolean) => MappedString[];
  indexToLineCol: (
    str: MappedString,
    offset: number,
  ) => { line: number; column: number };
}

/**
 * Jupyter notebook operations namespace
 */
export interface JupyterNamespace {
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
}

/**
 * Format detection namespace
 */
export interface FormatNamespace {
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
}

/**
 * Path operations namespace
 */
export interface PathNamespace {
  absolute: (path: string | URL) => string;
  toForwardSlashes: (path: string) => string;
  runtime: (subdir?: string) => string;
  resource: (...parts: string[]) => string;
  dirAndStem: (file: string) => [string, string];
  isQmdFile: (file: string) => boolean;
  inputFilesDir: (input: string) => string;
  dataDir: (subdir?: string, roaming?: boolean) => string;
}

/**
 * System operations namespace
 */
export interface SystemNamespace {
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
}

/**
 * Text processing namespace
 */
export interface TextNamespace {
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
}

/**
 * Console I/O namespace
 */
export interface ConsoleNamespace {
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
}

/**
 * Cryptography namespace
 */
export interface CryptoNamespace {
  md5Hash: (content: string) => string;
}

/**
 * Main QuartoAPI interface combining all namespaces
 */
export interface QuartoAPI {
  markdownRegex: MarkdownRegexNamespace;
  mappedString: MappedStringNamespace;
  jupyter: JupyterNamespace;
  format: FormatNamespace;
  path: PathNamespace;
  system: SystemNamespace;
  text: TextNamespace;
  console: ConsoleNamespace;
  crypto: CryptoNamespace;
}

/**
 * Namespace providers for registry
 */
export interface NamespaceProviders {
  markdownRegex?: ProviderFunction<MarkdownRegexNamespace>;
  mappedString?: ProviderFunction<MappedStringNamespace>;
  jupyter?: ProviderFunction<JupyterNamespace>;
  format?: ProviderFunction<FormatNamespace>;
  path?: ProviderFunction<PathNamespace>;
  system?: ProviderFunction<SystemNamespace>;
  text?: ProviderFunction<TextNamespace>;
  console?: ProviderFunction<ConsoleNamespace>;
  crypto?: ProviderFunction<CryptoNamespace>;
}
