/*
 * notebook-context.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  ExecutedFile,
  RenderedFile,
  RenderResourceFiles,
  RenderServices,
} from "../../command/render/types.ts";
import { Format } from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";

export const kRemoteHref = "remote-href";
export const kHtmlPreview = "html-preview";
export const kJatsSubarticle = "jats-subarticle";
export const kRenderedIPynb = "rendered-ipynb";

export type RenderType = "html-preview" | "jats-subarticle" | "rendered-ipynb";

// Preview Options for HTML Previews
export interface NotebookPreviewOptions {
  back?: boolean;
}

// The core notebook interface
export interface Notebook {
  source: string;
  [kHtmlPreview]: NotebookPreview;
  [kJatsSubarticle]: NotebookPreview;
  [kRenderedIPynb]: NotebookPreview;
}

export interface NotebookPreview {
  output?: NotebookOutput;
  metadata?: NotebookMetadata;
}

export interface NotebookOutput {
  path: string;
  supporting: string[];
  resourceFiles: RenderResourceFiles;
}

export interface NotebookRenderResult {
  file: string;
  supporting?: string[];
  resourceFiles: RenderResourceFiles;
}

// Metadata that can be passed when rendering/resolving a notebook
export interface NotebookMetadata {
  title: string;
  filename: string;
  downloadHref?: string;
  backHref?: string;
  downloadFile?: string;
}

// The template for notebook views is expecting this schema
export interface NotebookTemplateMetadata extends NotebookMetadata {
  downloadLabel: string;
  backLabel: string;
}

export interface NotebookContext {
  // Retrieves the notebook from the context.
  get: (nbPath: string, context?: ProjectContext) => Notebook | undefined;
  // Resolves the data on an executedFile into data that will
  // create a `renderType` output when rendered.
  resolve: (
    nbPath: string,
    renderType: RenderType,
    executedFile: ExecutedFile,
    notebookMetadata?: NotebookMetadata,
    outputFile?: string,
  ) => Promise<ExecutedFile>;
  // Provide a preview to the notebook context (for example, if you rendered it yourself)
  addRendering: (
    nbPath: string,
    renderType: RenderType,
    result: RenderedFile,
  ) => void;
  removeRendering: (
    nbAbsPath: string,
    renderType: RenderType,
    preserveFiles: string[],
  ) => void;
  // Render a preview from scratch
  render: (
    nbPath: string,
    format: Format,
    renderType: RenderType,
    renderServices: RenderServices,
    notebookMetadata?: NotebookMetadata,
    project?: ProjectContext,
  ) => Promise<NotebookPreview>;
  // Previews are cleaned up when the notebook context is disposed, but
  // you can use this to mark specific notebook > rendertypes to not be cleaned up.
  preserve: (nbAbsPath: string, renderType: RenderType) => void;
  // called to cleanup the context
  cleanup: () => void;
}

export interface NotebookContributor {
  outputFile(nbAbsPath: string): string;
  resolve(
    nbAbsPath: string,
    token: string,
    executedFile: ExecutedFile,
    notebookMetadata?: NotebookMetadata,
    outputFile?: string,
  ): Promise<ExecutedFile>;
  render(
    nbAbsPath: string,
    format: Format,
    token: string,
    services: RenderServices,
    notebookMetadata?: NotebookMetadata,
    project?: ProjectContext,
  ): Promise<NotebookRenderResult>;
}
