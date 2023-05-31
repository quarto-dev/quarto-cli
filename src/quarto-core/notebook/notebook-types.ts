/*
 * notebook-context.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

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

export interface Notebook {
  source: string;
  title: string;
  [kRemoteHref]?: string;
  [kHtmlPreview]?: string;
  [kJatsSubarticle]?: string;
  [kRenderedIPynb]?: string;
}

export interface NotebookContext {
  notebooks: () => Notebook[];
}
