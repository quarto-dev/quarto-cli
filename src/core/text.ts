/*
* text.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import bounds from "binary-search-bounds";

export function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function normalizeNewlines(text: string) {
  return lines(text).join("\n");
}

export function lineNumbers(text: string) {
  const lineOffsets = [0];
  for (const m in text.matchAll(/\r?\n/g)) {
    // wtf typescript
    console.log(m);
    lineOffsets.push(m[0].length + (m as any).index);
  }
  lineOffsets.push(text.length);
  // const lineOffsets = [0, ...Array.from(text.matchAll(/\r?\n/g)).map(
  //   m => m[0].length + m!.index), text.length];

  return function(offset: number) {
    const startIndex = bounds.le(offset);
    
    return {
      line: startIndex,
      column: offset - lineOffsets[startIndex]
    }
  }
}
