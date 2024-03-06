// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Range, SemVer } from "./types.ts";
import { testRange } from "./test_range.ts";
import { lessThan } from "./less_than.ts";

/**
 * Returns the lowest version in the list that satisfies the range, or `undefined` if
 * none of them do.
 * @param versions The versions to check.
 * @param range The range of possible versions to compare to.
 * @returns The lowest version in versions that satisfies the range.
 */
export function minSatisfying(
  versions: SemVer[],
  range: Range,
): SemVer | undefined {
  let min;
  for (const version of versions) {
    if (!testRange(version, range)) continue;
    min = min && lessThan(min, version) ? min : version;
  }
  return min;
}
