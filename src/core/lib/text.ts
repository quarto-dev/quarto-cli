/*
* text.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { glb } from "./binary-search.ts";
import { quotedStringColor } from "./errors.ts";

export function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function normalizeNewlines(text: string) {
  return lines(text).join("\n");
}

// NB we can't use actual matchAll here because we need to support old
// Chromium in the IDE
//
// NB this mutates the regexp.
export function* matchAll(text: string, regexp: RegExp) {
  if (!regexp.global) {
    throw new Error("matchAll requires global regexps");
  }
  let match;
  while ((match = regexp.exec(text)) !== null) {
    yield match;
  }
}

export function* lineOffsets(text: string) {
  yield 0;
  for (const match of matchAll(text, /\r?\n/g)) {
    yield match.index + match[0].length;
  }
}

export function* lineBreakPositions(text: string) {
  for (const match of matchAll(text, /\r?\n/g)) {
    yield match.index;
  }
}

export function indexToRowCol(text: string) {
  const offsets = Array.from(lineOffsets(text));
  return function (offset: number) {
    if (offset === 0) {
      return {
        line: 0,
        column: 0,
      };
    }

    const startIndex = glb(offsets, offset);
    return {
      line: startIndex,
      column: offset - offsets[startIndex],
    };
  };
}

export function rowColToIndex(text: string) {
  const offsets = Array.from(lineOffsets(text));
  return function (position: { row: number; column: number }) {
    return offsets[position.row] + position.column;
  };
}

// just like the version on core/text.ts, but without the
// sprintf dependency
export function formatLineRange(
  text: string,
  firstLine: number,
  lastLine: number,
) {
  const lineWidth = Math.max(
    String(firstLine + 1).length,
    String(lastLine + 1).length,
  );
  const pad = " ".repeat(lineWidth);

  const ls = lines(text);

  const result = [];
  for (let i = firstLine; i <= lastLine; ++i) {
    const numberStr = `${pad}${i + 1}: `.slice(-(lineWidth + 2));
    const lineStr = ls[i];
    result.push({
      lineNumber: i,
      content: numberStr + quotedStringColor(lineStr),
      rawLine: ls[i],
    });
  }
  return {
    prefixWidth: lineWidth + 2,
    lines: result,
  };
}
