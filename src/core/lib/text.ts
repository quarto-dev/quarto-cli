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

// O(n1 * n2) naive edit string distance, don't use this on big texts!
export function editDistance(w1: string, w2: string): number {
  const cost = (c: string): number => {
    if ("_-".indexOf(c) !== -1) {
      return 1;
    }
    return 10;
  };
  const cost2 = (c1: string, c2: string): number => {
    if (c1 === c2) {
      return 0;
    }
    if ("_-".indexOf(c1) !== -1 && "_-".indexOf(c2) !== -1) {
      return 1;
    }
    if (c1.toLocaleLowerCase() === c2.toLocaleLowerCase()) {
      return 1;
    }
    const cc1 = c1.charCodeAt(0);
    const cc2 = c2.charCodeAt(0);

    if (cc1 >= 48 && cc1 <= 57 && cc2 >= 48 && cc2 <= 57) {
      return 1;
    }

    return 10;
  };

  const s1 = w1.length + 1;
  const s2 = w2.length + 1;
  let v = new Int32Array(s1 * s2);
  for (let i = 0; i < s1; ++i) {
    for (let j = 0; j < s2; ++j) {
      if (i === 0 && j === 0) {
        continue;
      } else if (i === 0) {
        v[i * s2 + j] = v[i * s2 + (j - 1)] + cost(w2[j - 1]);
      } else if (j === 0) {
        v[i * s2 + j] = v[(i - 1) * s2 + j] + cost(w1[i - 1]);
      } else {
        v[i * s2 + j] = Math.min(
          v[(i - 1) * s2 + (j - 1)] + cost2(w1[i - 1], w2[j - 1]),
          v[i * s2 + (j - 1)] + cost(w2[j - 1]),
          v[(i - 1) * s2 + j] + cost(w1[i - 1]),
        );
      }
    }
  }

  return v[(w1.length + 1) * (w2.length + 1) - 1];
}
