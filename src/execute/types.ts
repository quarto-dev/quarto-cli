/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../config/constants.ts";
import { Format, FormatPandoc, Metadata } from "../config/types.ts";

import { PartitionedMarkdown } from "../core/pandoc/types.ts";
import { RenderOptions, RenderResultFile } from "../command/render/types.ts";
import { MappedString } from "../core/lib/text-types.ts";
import { HandlerContextResults } from "../core/handlers/types.ts";
import { EngineProjectContext, ProjectContext } from "../project/types.ts";
import { Command } from "cliffy/command/mod.ts";
import type { QuartoAPI } from "../core/api/index.ts";
import type { CheckConfiguration } from "../command/check/check.ts";

export type { EngineProjectContext };

export const kQmdExtensions = [".qmd"];

export const kMarkdownEngine = "markdown";
export const kKnitrEngine = "knitr";
export const kJupyterEngine = "jupyter";
export const kJuliaEngine = "julia";

/**
 * Interface for the static discovery phase of execution engines
 * Used to determine which engine should handle a file
 */
export interface ExecutionEngineDiscovery {
  /**
   * Initialize the engine with the Quarto API (optional)
   * May be called multiple times but always with the same QuartoAPI object.
   * Engines should store the reference to use throughout their lifecycle.
   */
  init?: (quarto: QuartoAPI) => void;

  name: string;
  defaultExt: string;
  defaultYaml: (kernel?: string) => string[];
  defaultContent: (kernel?: string) => string[];
  validExtensions: () => string[];
  claimsFile: (file: string, ext: string) => boolean;
  claimsLanguage: (language: string) => boolean;
  canFreeze: boolean;
  generatesFigures: boolean;
  ignoreDirs?: () => string[] | undefined;

  /**
   * Semver range specifying the minimum required Quarto version for this engine
   * Examples: ">= 1.6.0", "^1.5.0", "1.*"
   */
  quartoRequired?: string;

  /**
   * Populate engine-specific CLI commands (optional)
   */
  populateCommand?: (command: Command) => void;

  /**
   * Check installation and capabilities for this engine (optional)
   * Used by `quarto check <engine-name>` command
   *
   * Engines implementing this method will automatically be available as targets
   * for the check command (e.g., `quarto check jupyter`, `quarto check knitr`).
   *
   * @param conf - Check configuration with output settings and services
   */
  checkInstallation?: (conf: CheckConfiguration) => Promise<void>;

  /**
   * Launch a dynamic execution engine with project context
   */
  launch: (context: EngineProjectContext) => ExecutionEngineInstance;
}

/**
 * Interface for the dynamic execution phase of execution engines
 * Used after a file has been assigned to an engine
 */
export interface ExecutionEngineInstance {
  name: string;
  canFreeze: boolean;

  markdownForFile(file: string): Promise<MappedString>;

  target: (
    file: string,
    quiet?: boolean,
    markdown?: MappedString,
  ) => Promise<ExecutionTarget | undefined>;

  partitionedMarkdown: (
    file: string,
    format?: Format,
  ) => Promise<PartitionedMarkdown>;

  filterFormat?: (
    source: string,
    options: RenderOptions,
    format: Format,
  ) => Format;

  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;

  executeTargetSkipped?: (
    target: ExecutionTarget,
    format: Format,
  ) => void;

  dependencies: (options: DependenciesOptions) => Promise<DependenciesResult>;

  postprocess: (options: PostProcessOptions) => Promise<void>;

  canKeepSource?: (target: ExecutionTarget) => boolean;

  intermediateFiles?: (input: string) => string[] | undefined;

  run?: (options: RunOptions) => Promise<void>;

  postRender?: (
    file: RenderResultFile,
  ) => Promise<void>;
}

// execution target (filename and context 'cookie')
export interface ExecutionTarget {
  source: string;
  input: string;
  markdown: MappedString;
  metadata: Metadata;
  data?: unknown;
  preEngineExecuteResults?: HandlerContextResults;
}

// execute options
export interface ExecuteOptions {
  target: ExecutionTarget;
  format: Format;
  resourceDir: string;
  tempDir: string;
  dependencies: boolean;
  projectDir?: string;
  libDir?: string;
  cwd: string;
  params?: { [key: string]: unknown };
  quiet?: boolean;
  previewServer?: boolean;
  handledLanguages: string[]; // list of languages handled by cell language handlers, after the execution engine
  project: ProjectContext;
}

// result of execution
export interface ExecuteResult {
  markdown: string;
  supporting: string[];
  filters: string[];
  metadata?: Metadata;
  pandoc?: FormatPandoc;
  includes?: PandocIncludes;
  engine?: string;
  engineDependencies?: Record<string, Array<unknown>>;
  preserve?: Record<string, string>;
  postProcess?: boolean;
  resourceFiles?: string[];
}

// result of execution after restoring source map
export interface MappedExecuteResult {
  markdown: MappedString;
  supporting: string[];
  filters: string[];
  metadata?: Metadata;
  pandoc?: FormatPandoc;
  includes?: PandocIncludes;
  engineDependencies?: Record<string, Array<unknown>>;
  preserve?: Record<string, string>;
  postProcess?: boolean;
  resourceFiles?: string[];
}

export interface PandocIncludes {
  [kIncludeBeforeBody]?: string[];
  [kIncludeAfterBody]?: string[];
  [kIncludeInHeader]?: string[];
}

// dependencies options
export interface DependenciesOptions {
  target: ExecutionTarget;
  format: Format;
  output: string;
  resourceDir: string;
  tempDir: string;
  projectDir?: string;
  libDir?: string;
  dependencies?: Array<unknown>;
  quiet?: boolean;
}

// dependencies result
export interface DependenciesResult {
  includes: PandocIncludes;
}

// post processing options
export interface PostProcessOptions {
  engine: ExecutionEngineInstance;
  target: ExecutionTarget;
  format: Format;
  output: string;
  tempDir: string;
  projectDir?: string;
  preserve?: Record<string, string>;
  quiet?: boolean;
}

// run options
export interface RunOptions {
  input: string;
  render: boolean;
  browser: boolean;
  tempDir: string;
  reload?: boolean;
  format?: string;
  projectDir?: string;
  port?: number;
  host?: string;
  quiet?: boolean;
  onReady?: () => Promise<void>;
}
