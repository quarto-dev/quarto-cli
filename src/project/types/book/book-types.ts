/*
 * book-types.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

export type BookRenderItemType = "index" | "chapter" | "appendix" | "part";

export interface BookRenderItem {
  type: BookRenderItemType;
  depth: number;
  text?: string;
  file?: string;
  number?: number;
}
export type BookChapterEntry = BookPart | string;
export interface BookPart {
  part: string;
  chapters: string[];
}
