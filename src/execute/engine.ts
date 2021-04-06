/*
* engine.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Format } from "../config/format.ts";
import { Metadata } from "../config/metadata.ts";
import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../config/constants.ts";

import { knitrEngine } from "./rmd.ts";
import { jupyterEngine } from "./jupyter/jupyter.ts";
import { markdownEngine } from "./markdown.ts";

export interface ExecutionEngine {
  name: string;
  defaultExt: string;
  defaultYaml: (kernel?: string) => string[];
  canHandle: (file: string, contentOnly: boolean) => boolean;
  target: (
    file: string,
    quiet?: boolean,
  ) => Promise<ExecutionTarget | undefined>;
  metadata: (file: string) => Promise<Metadata>;
  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;
  dependencies: (options: DependenciesOptions) => Promise<DependenciesResult>;
  postprocess: (options: PostProcessOptions) => Promise<void>;
  keepMd: (input: string) => string | undefined;
  keepFiles: (input: string) => string[] | undefined;
  ignoreDirs?: () => RegExp[] | undefined;
  renderOnChange?: boolean;
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
  includes: PandocIncludes;
  dependencies?: unknown;
  preserve?: Record<string, string>;
}

export interface PandocIncludes {
  [kIncludeBeforeBody]?: string;
  [kIncludeAfterBody]?: string;
  [kIncludeInHeader]?: string;
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
  quiet?: boolean;
}

const kEngines = [
  knitrEngine,
  jupyterEngine,
  markdownEngine,
];

export function executionEngines() {
  return kEngines.map((engine) => engine.name);
}

export function executionEngine(name: string) {
  // try to find an engine
  for (const engine of kEngines) {
    if (engine.name === name) {
      return engine;
    }
  }
}

export function fileExecutionEngine(file: string, contentOnly = false) {
  // try to find an engine
  for (const engine of kEngines) {
    if (engine.canHandle) {
      if (engine.canHandle(file, contentOnly)) {
        return engine;
      }
    }
  }
}

export function engineIgnoreDirs() {
  const ignoreDirs: RegExp[] = [];
  executionEngines().forEach((name) => {
    const engine = executionEngine(name);
    if (engine && engine.ignoreDirs) {
      const engineIgnores = engine.ignoreDirs();
      if (engineIgnores) {
        ignoreDirs.push(...engineIgnores);
      }
    }
  });
  return ignoreDirs;
}
