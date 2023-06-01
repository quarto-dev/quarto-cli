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
import { ProjectContext } from "../../project/types.ts";

// Notebook
//  source: string
//  title: string
//  remote-href?: string
//  html-preview?: path
//  jats-subarticle?: path
//  rendered-ipynb?: path
export const kRemoteHref = "remote-href";
export const kHtmlPreview = "html-preview";
export const kJatsSubarticle = "jats-subarticle";
export const kRenderedIPynb = "rendered-ipynb";

export type RenderType = "html-preview" | "jats-subarticle" | "rendered-ipynb";

export interface Notebook {
  source: string;
  title: string;
  [kRemoteHref]?: string;
  [kHtmlPreview]?: NotebookOutput;
  [kJatsSubarticle]?: NotebookOutput;
  [kRenderedIPynb]?: NotebookOutput;
}

export interface NotebookOutput {
  path: string;
  supporting: string[];
  resourceFiles: RenderResourceFiles;
}

export interface NotebookContext {
  get: (nbPath: string) => Notebook | undefined;
  resolve: (
    nbPath: string,
    renderType: RenderType,
    executedFile: ExecutedFile,
  ) => ExecutedFile | undefined;
  contribute: (
    nbPath: string,
    renderType: RenderType,
    result: RenderedFile,
  ) => void;
  render: (
    nbPath: string,
    renderType: RenderType,
    renderServices: RenderServices,
    project?: ProjectContext,
  ) => Promise<Notebook | undefined>;
  cleanup: () => void;
}
