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
