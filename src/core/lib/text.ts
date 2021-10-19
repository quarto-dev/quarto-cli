/*
* text.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { glb } from "./binary-search.ts";

export function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function normalizeNewlines(text: string) {
  return lines(text).join("\n");
}

// we can't use matchAll here because we need to support old Chromium
// in the IDE
export function lineOffsets(text: string) {
  const offsets = [0];
  const re = /\r?\n/g;
  let match;
  while ((match = re.exec(text)) != null) {
    offsets.push(match.index);
  }
  return offsets;
}

export function indexToRowCol(text: string) {
  const offsets = lineOffsets(text);
  return function(offset: number) {
    const startIndex = glb(offsets, offset);
    
    return {
      line: startIndex,
      column: offset - offsets[startIndex]
    }
  }
}

export function rowColToIndex(text: string) {
  const offsets = lineOffsets(text);
  return function(position: { row: number, column: number }) {
    return offsets[position.row] + position.column;
  }
}
