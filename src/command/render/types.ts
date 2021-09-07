/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";

import { Format, PandocFlags } from "../../config/types.ts";
import {
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
} from "../../execute/types.ts";
import { Metadata } from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";

export const kMarkdownBlockSeparator = "\n\n<!-- -->\n\n";
export const kDefaultHighlightStyle = "arrow";

// options for render
export interface RenderOptions {
  flags?: RenderFlags;
  pandocArgs?: string[];
  progress?: boolean;
  useFreezer?: boolean;
  devServerReload?: boolean;
}

// context for render
export interface RenderContext {
  target: ExecutionTarget;
  options: RenderOptions;
  engine: ExecutionEngine;
  format: Format;
  libDir: string;
  project?: ProjectContext;
}

export interface RunPandocResult {
  resources: string[];
  htmlPostprocessors: Array<(doc: Document) => Promise<string[]>>;
}

export interface RenderResourceFiles {
  globs: string[];
  files: string[];
}

export interface RenderResult {
  baseDir?: string;
  outputDir?: string;
  files: RenderResultFile[];
  error?: Error;
}

export interface RenderResultFile {
  input: string;
  markdown: string;
  format: Format;
  file: string;
  supporting?: string[];
  resourceFiles: string[];
}

export interface RenderedFile {
  input: string;
  markdown: string;
  format: Format;
  file: string;
  supporting?: string[];
  resourceFiles: RenderResourceFiles;
  selfContained: boolean;
}

export interface RenderExecuteOptions {
  resolveDependencies?: boolean;
  alwaysExecute?: boolean;
}

export interface ExecutedFile {
  context: RenderContext;
  recipe: OutputRecipe;
  executeResult: ExecuteResult;
  resourceFiles: string[];
}

export interface PandocRenderer {
  onBeforeExecute: (format: Format) => RenderExecuteOptions;
  onRender: (format: string, file: ExecutedFile) => Promise<void>;
  onComplete: (error?: boolean) => Promise<RenderFilesResult>;
}

export interface RenderFilesResult {
  files: RenderedFile[];
  error?: Error;
}

// options required to run pandoc
export interface PandocOptions {
  // markdown input
  markdown: string;

  // original source file
  source: string;

  // original metadata
  metadata: Metadata;

  // output file that will be written
  output: string;

  // lib dir for converstion
  libDir: string;

  // target format
  format: Format;
  // command line args for pandoc
  args: string[];

  // optoinal project context
  project?: ProjectContext;

  // command line flags (e.g. could be used
  // to specify e.g. quiet or pdf engine)
  flags?: RenderFlags;

  // optional offset from file to project dir
  offset?: string;
}

// command line flags that we need to inspect
export interface RenderFlags extends PandocFlags {
  // quarto flags
  executeDir?: string;
  execute?: boolean;
  executeCache?: true | false | "refresh";
  executeDaemon?: number;
  executeDaemonRestart?: boolean;
  executeDebug?: boolean;
  metadata?: { [key: string]: unknown };
  params?: { [key: string]: unknown };
  paramsFile?: string;
  debug?: boolean;
  quiet?: boolean;
}

export interface OutputRecipe {
  // --output file that pandoc will produce
  output: string;
  // transformed pandoc args reflecting 'output'
  args: string[];
  // modifications to format spec
  format: Format;
  // callback for completing the output recipe (e.g. might run pdflatex, etc.).
  // can optionally return an alternate output path. passed the actual
  // options used to run pandoc (for deducing e.g. pdf engine options)
  complete: (options: PandocOptions) => Promise<string | void>;
}
