/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../config/constants.ts";
import { Format, Metadata } from "../config/types.ts";

import { PartitionedMarkdown } from "../core/pandoc/types.ts";
import { RenderOptions } from "../command/render/types.ts";

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
  claimsExtension: (ext: string) => boolean;
  claimsLanguage: (language: string) => boolean;
  target: (
    file: string,
    quiet?: boolean,
  ) => Promise<ExecutionTarget | undefined>;
  partitionedMarkdown: (file: string) => Promise<PartitionedMarkdown>;
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
  canKeepSource?: (target: ExecutionTarget) => boolean;
  keepFiles?: (input: string) => string[] | undefined;
  ignoreDirs?: () => string[] | undefined;
  run?: (options: RunOptions) => Promise<void>;
}

// execution target (filename and context 'cookie')
export interface ExecutionTarget {
  source: string;
  input: string;
  markdown: string;
  metadata: Metadata;
  data?: unknown;
}

// execute options
export interface ExecuteOptions {
  target: ExecutionTarget;
  format: Format;
  resourceDir: string;
  tempDir: string;
  dependencies: boolean;
  libDir?: string;
  cwd?: string;
  params?: { [key: string]: unknown };
  quiet?: boolean;
}

// result of execution
export interface ExecuteResult {
  markdown: string;
  supporting: string[];
  filters: string[];
  metadata?: Metadata;
  includes?: PandocIncludes;
  engineDependencies?: Array<unknown>;
  preserve?: Record<string, string>;
  postProcess?: boolean;
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
  preserve?: Record<string, string>;
  quiet?: boolean;
}

// run options
export interface RunOptions {
  input: string;
  render: boolean;
  port?: number;
  host?: string;
  quiet?: boolean;
}
