/*
* engine.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// deno-lint-ignore-file camelcase

import { Format, FormatPandoc } from "../config/format.ts";
import { Metadata } from "../config/metadata.ts";

import { rmdEngine } from "./rmd.ts";
import { jupyterEngine } from "./jupyter/jupyter.ts";
import { markdownEngine } from "./markdown.ts";

export interface ExecutionEngine {
  name: string;
  canHandle: (file: string) => boolean;
  target: (
    file: string,
    quiet?: boolean,
  ) => Promise<ExecutionTarget | undefined>;
  metadata: (target: ExecutionTarget) => Promise<Metadata>;
  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;
  dependencies: (options: DependenciesOptions) => Promise<DependenciesResult>;
  postprocess: (options: PostProcessOptions) => Promise<void>;
  keepMd: (input: string) => string | undefined;
  run?: (options: RunOptions) => Promise<void>;
}

// execution target (filename and context 'cookie')
export interface ExecutionTarget {
  source: string;
  input: string;
  data?: unknown;
}

// execute options
export interface ExecuteOptions {
  target: ExecutionTarget;
  format: Format;
  resourceDir: string;
  tempDir: string;
  dependencies: boolean;
  cwd?: string;
  params?: { [key: string]: unknown };
  quiet?: boolean;
}

// result of execution
export interface ExecuteResult {
  markdown: string;
  files_dir?: string;
  supporting: string[];
  filters: string[];
  pandoc: FormatPandoc;
  dependencies?: unknown;
  preserve?: Record<string, string>;
}

// result of pandoc render
export interface PandocResult {
  finalOutput: string;
  resourceFiles: string[];
}

// dependencies options
export interface DependenciesOptions {
  target: ExecutionTarget;
  format: Format;
  output: string;
  resourceDir: string;
  tempDir: string;
  libDir?: string;
  dependencies?: unknown;
  quiet?: boolean;
}

// dependencies result
export interface DependenciesResult {
  pandoc: FormatPandoc;
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
  quiet?: boolean;
}

const kEngines = [
  rmdEngine,
  jupyterEngine,
  markdownEngine,
];

export function executionEngine(file: string) {
  // try to find an engine
  for (const engine of kEngines) {
    if (engine.canHandle) {
      if (engine.canHandle(file)) {
        return engine;
      }
    }
  }
}
