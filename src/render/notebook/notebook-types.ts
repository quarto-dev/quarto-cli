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

// TODO: Is this still useful?
export interface NotebookPreviewConfig {
  title: string;
  url?: string;
  downloadUrl?: string;
  previewFileName: string;
  downloadFileName?: string;
  downloadFilePath?: string;
  backHref?: string;
}

export interface NotebookContext {
  get: (nbPath: string) => Notebook | undefined;
  resolve: (
    nbPath: string,
    renderType: RenderType,
    executedFile: ExecutedFile,
    notebookMetadata?: NotebookMetadata,
  ) => Promise<ExecutedFile>;
  addPreview: (
    nbPath: string,
    renderType: RenderType,
    result: RenderedFile,
  ) => void;
  render: (
    nbPath: string,
    format: Format,
    renderType: RenderType,
    renderServices: RenderServices,
    notebookMetadata?: NotebookMetadata,
    project?: ProjectContext,
  ) => Promise<NotebookPreview>;
  cleanup: () => void;
}

export interface NotebookContributor {
  resolve(
    nbAbsPath: string,
    token: string,
    executedFile: ExecutedFile,
    notebookMetadata?: NotebookMetadata,
  ): Promise<ExecutedFile>;
  render(
    nbAbsPath: string,
    format: Format,
    token: string,
    services: RenderServices,
    notebookMetadata?: NotebookMetadata,
    project?: ProjectContext,
  ): Promise<RenderedFile>;
}
