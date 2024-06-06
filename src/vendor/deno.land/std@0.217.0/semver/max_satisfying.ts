// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Range, SemVer } from "./types.ts";
import { testRange } from "./test_range.ts";
import { greaterThan } from "./greater_than.ts";

/**
 * Returns the highest version in the list that satisfies the range, or `undefined`
 * if none of them do.
 * @param versions The versions to check.
 * @param range The range of possible versions to compare to.
 * @returns The highest version in versions that satisfies the range.
 */
export function maxSatisfying(
  versions: SemVer[],
  range: Range,
): SemVer | undefined {
  let max;
  for (const version of versions) {
    if (!testRange(version, range)) continue;
    max = max && greaterThan(max, version) ? max : version;
  }
  return max;
}
