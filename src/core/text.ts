/*
* text.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { sprintf } from "fmt/printf.ts";
import { rgb24 } from "fmt/colors.ts";

import { lines } from "./lib/text.ts";

// reexports from lib
export {
  indexToLineCol,
  lineBreakPositions,
  lineOffsets,
  lines,
  matchAll,
  normalizeNewlines,
} from "./lib/text.ts";

export function formatLineRange(
  text: string,
  firstLine: number,
  lastLine: number,
) {
  const lineWidth = Math.max(
    String(firstLine + 1).length,
    String(lastLine + 1).length,
  );

  const ls = lines(text);

  const result = [];
  for (let i = firstLine; i <= lastLine; ++i) {
    const numberStr = rgb24(sprintf(`%${lineWidth}d: `, i + 1), 0x800000);
    const lineStr = rgb24(ls[i], 0xff0000);
    result.push({
      lineNumber: i,
      content: numberStr + lineStr,
      rawLine: ls[i],
    });
  }
  return {
    prefixWidth: lineWidth + 2,
    lines: result,
  };
}

export function truncateText(text: string, length: number) {
  if (text.length < length) {
    return text;
  } else {
    // Since we'll insert elips, trim an extra space
    const clipLength = length - 1;
    const clipped = text.substring(0, clipLength);
    const lastSpace = clipped.lastIndexOf(" ");
    if (lastSpace > 0) {
      return clipped.substring(0, lastSpace) + "…";
    } else {
      return clipped + "…";
    }
  }
}
