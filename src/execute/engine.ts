/*
* engine.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Format, FormatPandoc } from "../config/format.ts";
import { PdfEngine } from "../config/pdf.ts";
import { Metadata } from "../config/metadata.ts";

import { rmdEngine } from "./rmd.ts";
import { jupyterEngine } from "./jupyter.ts";
import { markdownEngine } from "./markdown.ts";

export interface ExecutionEngine {
  name: string;
  handle: (
    file: string,
    quiet: boolean,
  ) => Promise<ExecutionTarget | undefined>;
  metadata: (target: ExecutionTarget) => Promise<Metadata>;
  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;
  postprocess: (options: PostProcessOptions) => Promise<void>;
  keepMd: (input: string) => string | undefined;
  latexmk?: (options: LatexmkOptions) => Promise<void>;
  run?: (options: RunOptions) => Promise<void>;
}

// execution target (filename and context 'cookie')
export interface ExecutionTarget {
  input: string;
  data?: unknown;
}

export interface ExecutionKernel {
  keepalive?: number;
  restart?: boolean;
  debug?: boolean;
}

// execute options
export interface ExecuteOptions {
  target: ExecutionTarget;
  output: string;
  format: Format;
  tempDir: string;
  resourceDir: string;
  kernel: ExecutionKernel;
  cwd?: string;
  params?: { [key: string]: unknown };
  quiet?: boolean;
}

// result of execution
export interface ExecuteResult {
  supporting: string[];
  filters: string[];
  pandoc: FormatPandoc;
  preserve?: Record<string, string>;
  postprocess?: unknown;
}

// post processing options
export interface PostProcessOptions {
  engine: ExecutionEngine;
  target: ExecutionTarget;
  format: Format;
  output: string;
  preserve?: Record<string, string>;
  data?: unknown;
  quiet?: boolean;
}

// latexmk options
export interface LatexmkOptions {
  input: string;
  engine: PdfEngine;
  clean?: boolean;
  quiet?: boolean;
}

// run options
export interface RunOptions {
  input: string;
  render: boolean;
  port?: number;
  quiet?: boolean;
}

export async function executionEngine(file: string, quiet?: boolean) {
  const engines = [
    rmdEngine,
    jupyterEngine,
  ];

  // try to find an engine
  for await (const engine of engines) {
    const target = await engine.handle(file, !!quiet);
    if (target) {
      return { target, engine };
    }
  }

  // if there is no engine, this is plain markdown
  return { target: { input: file }, engine: markdownEngine() };
}
