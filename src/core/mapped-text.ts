/**
* mapped-text.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { diffLines } from "diff";
import { Range, rangedLines } from "./lib/ranged-text.ts";

import {
  mappedString,
  asMappedString,
  mappedConcat,
  mappedLineNumbers
} from "./lib/mapped-text.ts";

import * as mt from "./lib/mapped-text.ts";

export type MappedString = mt.MappedString;
export type StringChunk = mt.StringChunk;

export {
  mappedString,
  asMappedString,
  mappedConcat,
  mappedLineNumbers
} from "./lib/mapped-text.ts";

// uses a diff algorithm to map on a line-by-line basis target lines
// for `target` to `source`, allowing us to mostly recover
// MappedString information from third-party tools like knitr.
export function mappedDiff(
  source: MappedString,
  target: string
)
{
  const sourceLineRanges = rangedLines(source.value).map(x => x.range);
  const targetLineRanges = rangedLines(target);
  
  let sourceCursor = 0;

  const resultChunks: (string | Range)[] = [];

  for (const action of diffLines(source.value, target)) {
    if (action.removed) {
      // skip this many lines from the source
      sourceCursor += action.count;
    } else if (action.added) {
      resultChunks.push(action.value);
    } else {
      // it's from the source
      const start = sourceLineRanges[sourceCursor].start
      const nextCursor = sourceCursor + action.count;
      const end = nextCursor < sourceLineRanges.length ?
        sourceLineRanges[nextCursor].start :
        sourceLineRanges[sourceLineRanges.length - 1].end; // 
      sourceCursor = nextCursor;
      resultChunks.push({ start, end });
    }
  }

  return mappedString(source, resultChunks);
}
