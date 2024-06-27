// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { INVALID } from "./constants.ts";
import type { Range, SemVer } from "./types.ts";
import { testRange } from "./test_range.ts";
import { comparatorMin } from "./_comparator_min.ts";
import { lessThan } from "./less_than.ts";

/**
 * The minimum valid SemVer for a given range or INVALID
 * @param range The range to calculate the min for
 * @returns A valid SemVer or INVALID
 */
export function rangeMin(range: Range): SemVer {
  let min;
  for (const comparators of range) {
    for (const comparator of comparators) {
      const candidate = comparatorMin(comparator);
      if (!testRange(candidate, range)) continue;
      min = (min && lessThan(min, candidate)) ? min : candidate;
    }
  }
  return min ?? INVALID;
}
