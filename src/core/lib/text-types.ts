/*
* text-types.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

// types from ranged-text.ts
export interface Range {
  start: number;
  end: number;
}

// A ranged substring is simply a substring of some string plus the
// positional information. It's used to carry positional information of
// source code as it's processed through the system.
//
// The defining property is:
//
// const rangedSub = rangedSubstring(src, start, end);
// assert(rangedSub === src.substring(rangedSub.range.start, rangedSub.range.end));
export interface RangedSubstring {
  readonly substring: string;
  readonly range: Range;
}

// types from mapped-text.ts
export interface MappedString {
  readonly value: string;
  readonly originalString: string;
  readonly fileName?: string;
  map: (a: number) => number | undefined;
  mapClosest: (a: number) => number | undefined;
}

export type EitherString = string | MappedString;
export type StringChunk = string | Range;
