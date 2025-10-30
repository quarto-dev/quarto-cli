/*
 * jupyter-types.d.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

// deno-lint-ignore-file camelcase

import { ExecuteOptions } from './execution-engine.ts';
import { Metadata } from './metadata-types.ts';

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
 * Jupyter notebook structure
 */
export interface JupyterNotebook {
  cells: JupyterCell[];
  metadata: {
    kernelspec: JupyterKernelspec;
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

