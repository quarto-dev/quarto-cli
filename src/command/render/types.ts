/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document } from "../../core/deno-dom.ts";

import { Format, PandocFlags, QuartoFilter } from "../../config/types.ts";
import {
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
} from "../../execute/types.ts";
import { Metadata } from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { TempContext } from "../../core/temp-types.ts";
import { ExtensionContext } from "../../extension/types.ts";
import { kPositionedRefs } from "../../config/constants.ts";

// options for render
export interface RenderOptions {
  services: {
    temp: TempContext;
    extension: ExtensionContext;
  };
  flags?: RenderFlags;
  pandocArgs?: string[];
  progress?: boolean;
  useFreezer?: boolean;
  devServerReload?: boolean;
  previewServer?: boolean;
  setProjectDir?: boolean;
  echo?: boolean;
  warning?: boolean;
  quietPandoc?: boolean;
}

export interface RenderServices {
  temp: TempContext;
  extension: ExtensionContext;
}

// context for render
export interface RenderContext {
  target: ExecutionTarget;
  options: RenderOptions;
  engine: ExecutionEngine;
  format: Format;
  libDir: string;
  project?: ProjectContext;
  active: boolean;
}

export interface RunPandocResult {
  inputMetadata: Metadata;
  inputTraits: PandocInputTraits;
  resources: string[];
  postprocessors?: Array<
    (output: string) => Promise<{ supporting: string[] } | void>
  >;
  htmlPostprocessors: Array<HtmlPostProcessor>;
  htmlFinalizers?: Array<(doc: Document) => Promise<void>>;
}

export interface PandocInputTraits {
  [kPositionedRefs]?: boolean;
}

export type HtmlPostProcessor = (
  doc: Document,
  options: {
    inputMetadata: Metadata;
    inputTraits: PandocInputTraits;
    renderedFormats: RenderedFormat[];
    quiet?: boolean;
  },
) => Promise<HtmlPostProcessResult>;

export interface HtmlPostProcessResult {
  // Relative paths to resources
  resources: string[];
  // Supporting files should be absolute paths to the files or directories
  supporting: string[];
}
export interface RenderResourceFiles {
  globs: string[];
  files: string[];
}

export interface RenderResult {
  context?: ProjectContext;
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
  isTransient?: boolean;
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
  isTransient?: boolean; // from recipe, indicates that this file shouldn't be copied (eg to project destination)
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
  onPostProcess: (
    renderedFormats: RenderedFormat[],
  ) => Promise<void>;
  onComplete: (error?: boolean, quiet?: boolean) => Promise<RenderFilesResult>;
}

export interface RenderedFormat {
  path: string;
  format: Format;
  isTransient?: boolean;
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

  // is the keepYaml flag set
  keepYaml: boolean;

  // mediabag directory
  mediabagDir: string;

  // lib dir for converstion
  libDir: string;

  // target format
  format: Format;

  // command line args for pandoc
  args: string[];

  // the render services
  services: RenderServices;

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
  siteUrl?: string;
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
  version?: string;
}

export interface OutputRecipe {
  // --output file that pandoc will produce
  output: string;
  // are we implementing keepYaml
  keepYaml: boolean;
  // transformed pandoc args reflecting 'output'
  args: string[];
  // modifications to format spec
  format: Format;
  // callback for completing the output recipe (e.g. might run pdflatex, etc.).
  // can optionally return an alternate output path. passed the actual
  // options used to run pandoc (for deducing e.g. pdf engine options)
  complete: (options: PandocOptions) => Promise<string | void>;

  // The final output for the recipe (if different than the output itself)
  finalOutput?: string;

  isOutputTransient?: boolean;
}

export type QuartoFilterSpec = {
  // these are filters that will be sent to pandoc directly
  quartoFilters: QuartoFilter[];

  beforeQuartoFilters: QuartoFilter[];
  afterQuartoFilters: QuartoFilter[];
};

export interface PandocRenderCompletion {
  complete: (
    outputs: RenderedFormat[],
  ) => Promise<RenderedFile>;
}
