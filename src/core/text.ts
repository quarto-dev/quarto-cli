/*
* text.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function normalizeNewlines(text: string) {
  return lines(text).join("\n");
}

////////////////////////////////////////////////////////////////////////////////

export interface Range {
  start: number,
  end: number
};

export interface MappedString {
  value: string,
  map: (a: number) => number | undefined
};

export type StringChunk = string | Range;

/** 
mappedString provides a mechanism for maintaining offset information
through substrings. This comes up often in quarto, where we often pull
a part of a larger string, send that to an interpreter, compiler or
validator, and then want to report error information with respect to
line information in the first string.

One constructs a mappedString from a list of substring ranges of an
original string (or unmappable "new" substrings), which are
concatenated into the result. In addition to this new string,
mappedString returns a function "map" that sends offset from this new
string into offsets of the old string. Th

If you pass a MappedString as the input to this function, the result's
map will walk the inverse maps all the way to the raw, unmapped
string. This provides a natural composition for mapped strings.
*/
export function mappedString(
  source: string | MappedString, pieces: StringChunk[]
): MappedString
{
  interface OffsetInfo {
    fromSource: boolean;
    length: number;
    range?: Range
  };
  
  if (typeof source === "string") {
    const offsetInfo: OffsetInfo[] = [];

    const resultList = pieces.map(piece => {
      if (typeof piece === "string") {
        offsetInfo.push({
          fromSource: false,
          length: piece.length,
        });
        return piece;
      } else {
        const resultPiece = source.substring(piece.start, piece.end);
        offsetInfo.push({
          fromSource: true,
          length: resultPiece.length,
          range: {
            start: piece.start,
            end: piece.end
          }
        });
        return resultPiece;
      }
    });

    const value = resultList.join("");

    // FIXME this should really be a binary search..
    function map(offset: number) {
      if (offset < 0)
        return undefined;
      for (const info of offsetInfo) {
        if (offset < info.length) {
          if (info.fromSource === false) {
            return undefined;
          }
          return info.range!.start + offset;
        }
        offset -= info.length;
      }
      return undefined;
    }

    return {
      value,
      map
    }
  } else {
    const {
      value, map: previousMap
    } = source;

    const {
      value: resultValue,
      map: nextMap
    } = constructMappedString(value, pieces);

    function composeMap(offset: number) {
      const v = nextMap(offset);
      if (v === undefined) {
        return v;
      }
      return previousMap(v);
    }
    return {
      value: resultValue,
      map: composeMap
    };
  }
}
