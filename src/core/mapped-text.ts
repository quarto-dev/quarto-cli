/**
 * mapped-text.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { diffLines } from "./lib/external/diff.js";
import { rangedLines } from "./lib/ranged-text.ts";

import { asMappedString, mappedString } from "./lib/mapped-text.ts";

import { Range } from "./lib/text-types.ts";
import { relative } from "path/mod.ts";
import { warning } from "log/mod.ts";

import * as mt from "./lib/mapped-text.ts";
import { withTiming } from "./timing.ts";

export type EitherString = mt.EitherString;
export type MappedString = mt.MappedString;
export type StringChunk = mt.StringChunk;

export {
  asMappedString,
  mappedConcat,
  mappedIndexToLineCol,
  mappedNormalizeNewlines,
  mappedString,
  skipRegexp,
  skipRegexpAll,
} from "./lib/mapped-text.ts";

// uses a diff algorithm to map on a line-by-line basis target lines
// for `target` to `source`, allowing us to somewhat recover
// MappedString information from third-party tools like knitr.
export function mappedDiff(
  source: MappedString,
  target: string,
) {
  return withTiming("mapped-diff", () => {
    const sourceLineRanges = rangedLines(source.value).map((x) => x.range);

    let sourceCursor = 0;

    const resultChunks: (string | Range)[] = [];
    const started = performance.now();
    const maxTime = 2000; // don't let computation go for more than 2s.
    const diffResult = diffLines(
      source.value,
      target,
      () => {
        const now = performance.now();
        if (now - started > maxTime) {
          return true;
        }
      },
    );
    if (diffResult === undefined) {
      warning(
        "Warning: The computation used to determine source line information from the engine timed out.\nLine number information will be unavailable and/or inaccurate.",
      );
      return asMappedString(target);
    }
    for (const action of diffResult) {
      if (action.removed) {
        // skip this many lines from the source
        sourceCursor += action.count;
      } else if (action.added) {
        resultChunks.push(action.value);
      } else {
        // it's from the source
        const start = sourceLineRanges[sourceCursor].start;
        const nextCursor = sourceCursor + action.count;
        const end = nextCursor < sourceLineRanges.length
          ? sourceLineRanges[nextCursor].start
          : sourceLineRanges[sourceLineRanges.length - 1].end; //
        sourceCursor = nextCursor;
        resultChunks.push({ start, end });
      }
    }

    return mappedString(source, resultChunks, source.fileName);
  });
}

export function mappedStringFromFile(filename: string): MappedString {
  const value = Deno.readTextFileSync(filename);

  if (filename.startsWith("/")) {
    filename = relative(Deno.cwd(), filename);
  }
  return asMappedString(value, filename);
}
