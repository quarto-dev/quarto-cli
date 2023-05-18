/**
 * mapped-text.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { glb } from "./binary-search.ts";

import { rangedLines } from "./ranged-text.ts";

import {
  indexToLineCol as unmappedIndexToLineCol,
  lineBreakPositions,
  matchAll,
} from "./text.ts";

import {
  EitherString,
  MappedString,
  Range,
  RangedSubstring,
  StringChunk,
  StringMapResult,
} from "./text-types.ts";
import { InternalError } from "./error.ts";

export type {
  EitherString,
  MappedString,
  Range,
  RangedSubstring,
  StringChunk,
} from "./text-types.ts";

/**
 * returns a substring of the mapped string, together with associated maps
 *
 * @param source
 * @param start index for start of substring
 * @param end index for end of substring (optional)
 * @returns mapped string
 */
export function mappedSubstring(
  source: EitherString,
  start: number,
  end?: number,
): MappedString {
  if (typeof source === "string") {
    source = asMappedString(source);
  }
  const value = source.value.substring(start, end);
  // typescript doesn't see type stability across closures,
  // so we hold its hand a little here
  const mappedSource: MappedString = source;
  return {
    value,
    map: (index: number, closest?: boolean) => {
      if (closest) {
        index = Math.max(0, Math.min(value.length, index - 1));
      }
      // we need to special-case a zero-offset lookup from an empty string,
      // since those are necessary during error resolution of empty YAML values.
      if (index === 0 && index === value.length) {
        return mappedSource.map(index + start, closest);
      }
      if (index < 0 || index >= value.length) {
        return undefined;
      }
      return mappedSource.map(index + start, closest);
    },
  };
}

/**
mappedString provides a mechanism for maintaining offset information
through substrings. This comes up often in quarto, where we often pull
a part of a larger string, send that to an interpreter, compiler or
validator, and then want to report error information with respect to
line information in the first string.

You construct a mappedString from a list of substring ranges of an
original string (or unmappable "new" substrings), which are
concatenated into the result in the field `value`.

In the field `fileName`, we (optionally) keep a filename, strictly as
metadata for error reporting.

In addition to this new string, mappedString provides `map` that sends offsets from this new
string into offsets of the original "base" mappedString. If closest=true,
`map` attempts to avoid undefined results by
returning the closest smaller result that is valid in case it's called
with a value that has no inverse (such as an out-of-bounds access).

If you pass a MappedString as the input to this function, the result's
map will walk the inverse maps all the way to the base mappedString
(constructed from asMappedString).

This provides a natural composition for mapped strings.
*/

export function mappedString(
  source: EitherString,
  pieces: StringChunk[],
  fileName?: string,
): MappedString {
  interface OffsetInfo {
    fromSource: boolean;
    length: number;
    offset: number;
    range?: Range;
  }

  if (typeof source === "string") {
    source = asMappedString(source, fileName);
  }

  const mappedPieces = pieces.map((piece) => {
    if (typeof piece === "string") {
      return asMappedString(piece);
    } else if ((piece as MappedString).value !== undefined) {
      return piece as MappedString;
    } else {
      const { start, end } = piece as Range;
      return mappedSubstring(source, start, end);
    }
  });
  return mappedConcat(mappedPieces);
}

export function asMappedString(
  str: EitherString,
  fileName?: string,
): MappedString {
  if (typeof str === "string") {
    return {
      value: str,
      fileName,
      map: function (index: number, closest?: boolean): StringMapResult {
        if (closest) {
          index = Math.min(str.length - 1, Math.max(0, index));
        }
        if (index < 0 || index >= str.length) {
          return undefined;
        }
        return {
          index,
          originalString: this,
        };
      },
    };
  } else if (fileName !== undefined) {
    throw new InternalError(
      "can't change the fileName of an existing MappedString",
    );
  } else {
    return str;
  }
}

// Every mapped string parameter should have the same originalString and fileName.
// If none of the parameters are mappedstring, this returns a fresh
// MappedString
export function mappedConcat(strings: EitherString[]): MappedString {
  if (strings.length === 0) {
    return {
      value: "",
      map: (_index: number, _closest?: boolean) => undefined,
    };
  }
  if (strings.every((s) => typeof s === "string")) {
    return asMappedString(strings.join(""));
  }

  const mappedStrings = strings.map((s) => {
    if (typeof s === "string") {
      return asMappedString(s);
    } else return s;
  });
  let currentOffset = 0;
  const offsets: number[] = [0];
  for (const s of mappedStrings) {
    currentOffset += s.value.length;
    offsets.push(currentOffset);
  }
  const value = mappedStrings.map((s) => s.value).join("");

  return {
    value,
    map: (offset: number, closest?: boolean): StringMapResult => {
      if (closest) {
        offset = Math.max(0, Math.min(offset, value.length - 1));
      }
      // we need to special-case an offset-0 lookup into an empty mapped string
      // since those are necessary during error resolution of empty YAML values.
      if (offset === 0 && offset == value.length && mappedStrings.length) {
        return mappedStrings[0].map(0, closest);
      }
      if (offset < 0 || offset >= value.length) {
        return undefined;
      }
      const ix = glb(offsets, offset);
      const v = mappedStrings[ix];
      return v.map(offset - offsets[ix]);
    },
  };
}

// mapped version of text.ts:indexToLineCol
export function mappedIndexToLineCol(eitherText: EitherString) {
  const text = asMappedString(eitherText);

  return function (offset: number) {
    const mapResult = text.map(offset, true);
    if (mapResult === undefined) {
      throw new InternalError("bad offset in mappedIndexRowCol");
    }
    const { index, originalString } = mapResult;

    return unmappedIndexToLineCol(originalString.value)(index);
  };
}

// mapped version of text.ts:normalizeNewlines
export function mappedNormalizeNewlines(
  eitherText: EitherString,
): MappedString {
  const text = asMappedString(eitherText);

  // here we search for \r\n, and skip the \r's. that's slightly
  // different from the other implementation but the observable
  // behavior on .value is the same.

  let start = 0;
  const chunks: Range[] = [];
  for (const offset of lineBreakPositions(text.value)) {
    if (text.value[offset] !== "\r") {
      continue;
    }

    // we know this is an \r\n, so we handle it
    chunks.push({ start, end: offset }); // string contents
    chunks.push({ start: offset + 1, end: offset + 2 }); // \n part of \r\n
    start = offset + 2;
  }
  if (start !== text.value.length) {
    chunks.push({ start, end: text.value.length });
  }
  return mappedString(text, chunks);
}

// skipRegexpAll(s, r) is a mapped version of s.replaceAll(r, "")
export function skipRegexpAll(
  eitherText: EitherString,
  re: RegExp,
): MappedString {
  const text = asMappedString(eitherText);

  let start = 0;
  const chunks: Range[] = [];
  for (const match of matchAll(text.value, re)) {
    chunks.push({ start, end: match.index });
    start = match[0].length + match.index;
  }
  if (start !== text.value.length) {
    chunks.push({ start, end: text.value.length });
  }
  return mappedString(text, chunks);
}

// skipRegexp(s, r) is a mapped version of s.replace(r, "")
export function skipRegexp(eitherText: EitherString, re: RegExp): MappedString {
  const text = asMappedString(eitherText);
  const m = text.value.match(re);

  if (m) {
    return mappedString(text, [
      { start: 0, end: m.index! },
      { start: m.index! + m[0].length, end: text.value.length },
    ]);
  } else {
    return text;
  }
}

/**
 * join an array of EitherStrings into a single MappedString. This
 * is effectively the EitherString version of Array.prototype.join.
 */
export function join(mappedStrs: EitherString[], sep: string): MappedString {
  const innerStrings: MappedString[] = [];
  const mappedSep = asMappedString(sep);
  for (let i = 0; i < mappedStrs.length; ++i) {
    const mappedStr = mappedStrs[i];
    if (typeof mappedStr === "string") {
      innerStrings.push(asMappedString(mappedStr));
    } else {
      innerStrings.push(mappedStr);
    }
    if (i < mappedStrs.length) {
      innerStrings.push(mappedSep);
    }
  }
  return mappedConcat(innerStrings);
}

export function mappedLines(
  str: MappedString,
  keepNewLines = false,
): MappedString[] {
  const lines = rangedLines(str.value, keepNewLines);
  return lines.map((v: RangedSubstring) => mappedString(str, [v.range]));
}

export function mappedReplace(
  str: MappedString,
  target: string | RegExp,
  replacement: EitherString,
): MappedString {
  if (typeof target === "string") {
    const index = str.value.indexOf(target);
    if (index === -1) {
      return str;
    }
    return mappedConcat([
      mappedString(str, [{ start: 0, end: index }]),
      asMappedString(replacement),
      mappedString(str, [{
        start: index + target.length,
        end: str.value.length,
      }]),
    ]);
  }

  if (!target.global) {
    const result = target.exec(str.value);
    if (!result) {
      return str;
    }
    return mappedConcat([
      mappedSubstring(str, 0, target.lastIndex),
      asMappedString(replacement),
      mappedSubstring(
        str,
        target.lastIndex + result[0].length,
        str.value.length,
      ),
    ]);
  }

  let result = target.exec(str.value);
  if (!result) {
    return str;
  }
  let currentRange = 0;
  const pieces: MappedString[] = [];
  while (result) {
    pieces.push(
      mappedSubstring(str, currentRange, target.lastIndex),
    );
    pieces.push(asMappedString(replacement));
    currentRange = target.lastIndex + result[0].length;

    result = target.exec(str.value);
  }
  pieces.push(
    mappedSubstring(str, currentRange, str.value.length),
  );

  return mappedConcat(pieces);
}

/**
 * breakOnDelimiter() behaves like split(), except that it:
 *
 * - operates on MappedStrings
 * - returns an array of MappedStrings
 * - keeps the delimiters inside the string's results by default. This last
 *   quirk is often useful
 */
export function breakOnDelimiter(
  string: MappedString,
  delimiter: string,
  keepDelimiters = true,
): MappedString[] {
  let currentPosition = 0;
  let r = string.value.indexOf(delimiter, currentPosition);
  const substrings: MappedString[] = [];
  while (r !== -1) {
    const end = keepDelimiters ? r + delimiter.length : r;
    substrings.push(mappedSubstring(string, currentPosition, end));
    currentPosition = r + delimiter.length;
    r = string.value.indexOf(delimiter, currentPosition);
  }
  return substrings;
}

function findSpaceStart(string: MappedString): number {
  const result = string.value.match(/^\s+/);
  if (result === null || result.length === 0) {
    return 0;
  }
  return result[0].length;
}

function findSpaceEnd(string: MappedString): number {
  const result = string.value.match(/\s+$/);
  if (result === null || result.length === 0) {
    return 0;
  }
  return result[0].length;
}

/**
 * mappedTrim(): MappedString version of String.trim()
 */
export function mappedTrim(string: MappedString): MappedString {
  const start = findSpaceStart(string);
  const end = findSpaceEnd(string);
  if (start === 0 && end === 0) {
    return string;
  }
  if (start > string.value.length - end) {
    return mappedSubstring(string, 0, 0);
  }
  return mappedSubstring(string, start, string.value.length - end);
}

/**
 * mappedTrimStart(): MappedString version of String.trimStart()
 */
export function mappedTrimStart(string: MappedString): MappedString {
  const start = findSpaceStart(string);
  if (start === 0) {
    return string;
  }
  return mappedSubstring(string, start, string.value.length);
}

/**
 * mappedTrimEnd(): MappedString version of String.trimEnd()
 */
export function mappedTrimEnd(string: MappedString): MappedString {
  const end = findSpaceEnd(string);
  if (end === 0) {
    return string;
  }
  return mappedSubstring(string, 0, string.value.length - end);
}
