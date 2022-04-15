/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document } from "../../core/deno-dom.ts";

import { Format, PandocFlags } from "../../config/types.ts";
import {
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
} from "../../execute/types.ts";
import { Metadata } from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { TempContext } from "../../core/temp-types.ts";

export const kMarkdownBlockSeparator = "\n\n<!-- -->\n\n";
export const kDefaultHighlightStyle = "arrow";

// options for render
export interface RenderOptions {
  temp: TempContext;
  flags?: RenderFlags;
  pandocArgs?: string[];
  progress?: boolean;
  useFreezer?: boolean;
  devServerReload?: boolean;
  setProjectDir?: boolean;
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
  inputMetadata: Metadata;
  resources: string[];
  postprocessors?: Array<(output: string) => Promise<void>>;
  htmlPostprocessors: Array<HtmlPostProcessor>;
  htmlFinalizers?: Array<(doc: Document) => Promise<void>>;
}

export type HtmlPostProcessor = (
  doc: Document,
  inputMedata: Metadata,
) => Promise<HtmlPostProcessResult>;

export interface HtmlPostProcessResult {
  // Relative paths to resources
  resources: string[];
  // Supporting files should be absolute paths to the files or directories
  supporting: string[];
}

export const kHtmlEmptyPostProcessResult = {
  resources: [],
  supporting: [],
};

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
  supplemental?: boolean;
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
  onRender: (
    format: string,
    file: ExecutedFile,
    quiet: boolean,
  ) => Promise<void>;
  onComplete: (error?: boolean, quiet?: boolean) => Promise<RenderFilesResult>;
}

export interface RenderFile {
  path: string;
  formats?: string[];
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

  // output file that will be written
  output: string;

  // lib dir for converstion
  libDir: string;

  // target format
  format: Format;

  // command line args for pandoc
  args: string[];

  // temp context
  temp: TempContext;

  // extra metadata to merge
  metadata?: Metadata;

  // optoinal project context
  project?: ProjectContext;

  // quiet quarto pandoc informational output
  quiet?: boolean;

  // command line flags (e.g. could be used
  // to specify e.g. pdf engine)
  flags?: RenderFlags;

  // optional offset from file to project dir
  offset?: string;
}

// command line flags that we need to inspect
export interface RenderFlags extends PandocFlags {
  // quarto flags
  outputDir?: string;
  executeDir?: string;
  execute?: boolean;
  executeCache?: true | false | "refresh";
  executeDaemon?: number;
  executeDaemonRestart?: boolean;
  executeDebug?: boolean;
  useFreezer?: boolean;
  metadata?: { [key: string]: unknown };
  pandocMetadata?: { [key: string]: unknown };
  params?: { [key: string]: unknown };
  paramsFile?: string;
  clean?: boolean;
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
