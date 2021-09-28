/*
* ranged-text.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

export interface Range {
  start: number,
  end: number
};

// A ranged substring is simply a substring of some string plus the
// positional information. It's used to carry positional information of
// source code as it's processed through the system.
//
// The defining property is:
//
// const rangedSub = rangedSubstring(src, start, end);
// assert(rangedSub === src.substring(rangedSub.range.start, rangedSub.range.end));
export interface RangedSubstring {
  substring: string;
  range: Range;
};

export function rangedSubstring(
  src: string, start: number, end = -1
): RangedSubstring
{
  if (end === -1) {
    end = src.length;
  }
  
  const substring = src.substring(start, end);
  return {
    substring,
    range: { start, end }
  };
};

// RangedSubstring version of lines()
export function rangedLines(
  text: string
): RangedSubstring[]
{
  const regex = /\r?\n/g;
  const result: RangedSubstring[] = [];

  let startOffset = 0;
  for (const r of text.matchAll(regex)) {
    result.push({
      substring: text.substring(startOffset, r.index!),
      range: {
        start: startOffset,
        end: r.index!
      }
    });
    startOffset = r.index! + r[0].length;
  }
  result.push({
    substring: text.substring(startOffset, text.length),
    range: {
      start: startOffset,
      end: text.length
    }
  });
  return result;
}
