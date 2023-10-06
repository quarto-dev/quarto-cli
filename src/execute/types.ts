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
import { RenderOptions } from "../command/render/types.ts";
import { MappedString } from "../core/lib/text-types.ts";
import { HandlerContextResults } from "../core/handlers/types.ts";
import { ProjectContext } from "../project/types.ts";

export const kQmdExtensions = [".qmd"];

export const kMarkdownEngine = "markdown";
export const kKnitrEngine = "knitr";
export const kJupyterEngine = "jupyter";

export interface ExecutionEngine {
  name: string;
  defaultExt: string;
  defaultYaml: (kernel?: string) => string[];
  defaultContent: (kernel?: string) => string[];
  validExtensions: () => string[];
  claimsFile: (file: string, ext: string) => boolean;
  claimsLanguage: (language: string) => boolean;
  target: (
    file: string,
    quiet?: boolean,
    markdown?: MappedString,
    project?: ProjectContext,
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
  executeTargetSkipped?: (target: ExecutionTarget, format: Format) => void;
  dependencies: (options: DependenciesOptions) => Promise<DependenciesResult>;
  postprocess: (options: PostProcessOptions) => Promise<void>;
  canFreeze: boolean;
  generatesFigures: boolean;
  canKeepSource?: (target: ExecutionTarget) => boolean;
  intermediateFiles?: (input: string) => string[] | undefined;
  ignoreDirs?: () => string[] | undefined;
  run?: (options: RunOptions) => Promise<void>;
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
  cwd?: string;
  params?: { [key: string]: unknown };
  quiet?: boolean;
  previewServer?: boolean;
  handledLanguages: string[]; // list of languages handled by cell language handlers, after the execution engine
  projectType?: string;
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
  engine: ExecutionEngine;
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
  projectDir?: string;
  port: number;
  host: string;
  quiet?: boolean;
  onReady?: () => Promise<void>;
}
