/*
* break-quarto-md-types.ts
*
* types for break-quarto-md.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { MappedString } from "./text-types.ts";

export interface CodeCellType {
  language: string;
}

export interface DirectiveCell {
  language: "_directive";
  tag: string;
  attrs: Record<string, string>;

  // we need to carry directives' individual tag information for
  // later reconstruction.
  sourceOpenTag: MappedString;
  sourceCloseTag: MappedString;
}

export interface QuartoMdCell {
  id?: string;

  // deno-lint-ignore camelcase
  cell_type: CodeCellType | DirectiveCell | "markdown" | "raw" | "math";
  options?: Record<string, unknown>;

  source: MappedString;
  sourceVerbatim: MappedString;

  sourceOffset: number; // TODO these might be unnecessary now. Check back
  sourceStartLine: number;

  // line number of the start of the cell in the file, 0-based.
  //
  // NB this number means slightly different things depending on the
  // cell type. for markdown and raw cells, it's literally the first
  // line in the file corresponding to the cell. for code cells,
  // though, it's the first line of the _content_: it skips the triple
  // ticks.

  cellStartLine: number;
}

export interface QuartoMdChunks {
  cells: QuartoMdCell[];
}
