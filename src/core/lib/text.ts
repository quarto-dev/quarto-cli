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


// just like the version on core/text.ts, but without colors or the
// sprintf dependency
export function formatLineRange(
  text: string, firstLine: number, lastLine: number
)
{
  const lineWidth = Math.max(
    String(firstLine + 1).length,
    String(lastLine + 1).length);
  const pad = " ".repeat(lineWidth);

  const ls = lines(text);
  
  const result = [];
  for (let i = firstLine; i <= lastLine; ++i)
  {
    const numberStr = `${pad}${i + 1}`.slice(-lineWidth);
    const lineStr = ls[i];
    result.push({
      lineNumber: i,
      content: numberStr + lineStr,
      rawLine: ls[i]
    });
  }
  return {
    prefixWidth: lineWidth + 2,
    lines: result
  };
}
