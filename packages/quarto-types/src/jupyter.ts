/*
 * jupyter-types.d.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

// deno-lint-ignore-file camelcase

import type { ExecuteOptions } from './execution.ts';
import type { Metadata } from './metadata.ts';
import type { Format } from './format.ts';

/**
 * Jupyter notebook kernelspec
 */
export interface JupyterKernelspec {
  name: string;
  language: string;
  display_name: string;
  path?: string;
}

/**
 * Jupyter language info
 */
export type JupyterLanguageInfo = {
  name: string;
  codemirror_mode?: string | Record<string, unknown>;
  file_extension?: string;
  mimetype?: string;
  pygments_lexer?: string;
};

/**
 * Jupyter notebook cell metadata
 */
export interface JupyterCellMetadata {
  [key: string]: unknown;
}

/**
 * Jupyter notebook output
 */
export interface JupyterOutput {
  output_type: string;
  metadata?: {
    [mimetype: string]: Record<string, unknown>;
  };
  execution_count?: number;
  [key: string]: unknown;
}

/**
 * Jupyter output stream
 */
export interface JupyterOutputStream extends JupyterOutput {
  name: "stdout" | "stderr";
  text: string[] | string;
}

/**
 * Jupyter output display data
 */
export interface JupyterOutputDisplayData extends JupyterOutput {
  data: { [mimeType: string]: unknown };
  metadata: { [mimeType: string]: Record<string, unknown> };
  noCaption?: boolean;
}

/**
 * Jupyter output figure options
 */
export interface JupyterOutputFigureOptions {
  [key: string]: unknown;
}

/**
 * Jupyter cell options
 */
export interface JupyterCellOptions extends JupyterOutputFigureOptions {
  [key: string]: unknown;
}

/**
 * Jupyter cell with options
 */
export interface JupyterCellWithOptions extends JupyterCell {
  id: string;
  options: JupyterCellOptions;
  optionsSource: string[];
}

/**
 * Jupyter notebook cell
 */
export interface JupyterCell {
  cell_type: "markdown" | "code" | "raw";
  metadata: JupyterCellMetadata;
  source: string | string[];
  id?: string;
  execution_count?: number | null;
  outputs?: JupyterOutput[];
  attachments?: {
    [filename: string]: {
      [mimetype: string]: string | string[];
    };
  };
}

/**
 * Jupyter user expression
 */
export interface JupyterUserExpression {
  expression: string;
  result: JupyterUserExpressionResult;
}

/**
 * Jupyter user expression result
 */
export interface JupyterUserExpressionResult extends JupyterCellOutputData {
  metadata: Metadata;
  status: string;
}

/**
 * Jupyter cell output data
 */
export interface JupyterCellOutputData {
  data: { [mimeType: string]: unknown };
}

/**
 * Jupyter cell slideshow
 */
export interface JupyterCellSlideshow {
  [key: string]: string;
}

/**
 * Jupyter notebook structure
 */
export interface JupyterNotebook {
  cells: JupyterCell[];
  metadata: {
    kernelspec: JupyterKernelspec;
    widgets?: Record<string, unknown>;
    language_info?: JupyterLanguageInfo;
    [key: string]: unknown;
  };
  nbformat: number;
  nbformat_minor: number;
}

/**
 * Asset paths for Jupyter notebook output
 */
export interface JupyterNotebookAssetPaths {
  base_dir: string;
  files_dir: string;
  figures_dir: string;
  supporting_dir: string;
}

/**
 * Format execution options
 */
export interface FormatExecute {
  [key: string]: unknown;
}

/**
 * Format render options
 */
export interface FormatRender {
  [key: string]: unknown;
}

/**
 * Format pandoc options
 */
export interface FormatPandoc {
  to?: string;
  [key: string]: unknown;
}

/**
 * Jupyter widget state information
 */
export interface JupyterWidgetsState {
  state: Record<string, unknown>;
  version_major: number;
  version_minor: number;
}

/**
 * Widget dependencies from Jupyter notebook
 */
export interface JupyterWidgetDependencies {
  jsWidgets: boolean;
  jupyterWidgets: boolean;
  htmlLibraries: string[];
  widgetsState?: JupyterWidgetsState;
}

/**
 * Jupyter capabilities
 */
export interface JupyterCapabilities {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  versionStr: string;
  execPrefix: string;
  executable: string;
  conda: boolean;
  pyLauncher: boolean;
  jupyter_core: string | null;
  nbformat: string | null;
  nbclient: string | null;
  ipykernel: string | null;
  shiny: string | null;
}

/**
 * Extended Jupyter capabilities
 */
export interface JupyterCapabilitiesEx extends JupyterCapabilities {
  kernels?: JupyterKernelspec[];
  venv?: boolean;
}

/**
 * Cell output with markdown
 */
export interface JupyterCellOutput {
  id: string;
  markdown: string;
  metadata: Record<string, unknown>;
  options: Record<string, unknown>;
}

/**
 * Options for converting Jupyter notebook to markdown
 */
export interface JupyterToMarkdownOptions {
  executeOptions: ExecuteOptions;
  language: string;
  assets: JupyterNotebookAssetPaths;
  execute: FormatExecute;
  keepHidden?: boolean;
  toHtml: boolean;
  toLatex: boolean;
  toMarkdown: boolean;
  toIpynb: boolean;
  toPresentation: boolean;
  figFormat?: string;
  figDpi?: number;
  figPos?: string;
  preserveCellMetadata?: boolean;
  preserveCodeCellYaml?: boolean;
  outputPrefix?: string;
  fixups?: string | unknown[];
}

/**
 * Options for converting Quarto markdown to Jupyter notebook
 */
export interface QuartoMdToJupyterOptions {
  title?: string;
  format?: Format;
}

/**
 * Result of converting Jupyter notebook to markdown
 */
export interface JupyterToMarkdownResult {
  cellOutputs: JupyterCellOutput[];
  notebookOutputs?: {
    prefix?: string;
    suffix?: string;
  };
  dependencies?: JupyterWidgetDependencies;
  htmlPreserve?: Record<string, string>;
  pandoc?: Record<string, unknown>;
}

