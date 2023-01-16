/*
* text-types.ts
*
* Copyright (C) 2022 Posit Software, PBC
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

export type StringMapResult = {
  index: number;
  originalString: MappedString;
} | undefined;

export interface MappedString {
  readonly value: string;
  readonly fileName?: string;
  readonly map: (index: number, closest?: boolean) => StringMapResult;
}

export type EitherString = string | MappedString;
export type StringChunk = string | MappedString | Range;
