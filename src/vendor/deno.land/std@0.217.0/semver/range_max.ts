// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { INVALID } from "./constants.ts";
import type { Range, SemVer } from "./types.ts";
import { testRange } from "./test_range.ts";
import { comparatorMax } from "./_comparator_max.ts";
import { greaterThan } from "./greater_than.ts";

/**
 * The maximum valid SemVer for a given range or INVALID
 * @param range The range to calculate the max for
 * @returns A valid SemVer or INVALID
 */
export function rangeMax(range: Range): SemVer {
  let max;
  for (const comparators of range) {
    for (const comparator of comparators) {
      const candidate = comparatorMax(comparator);
      if (!testRange(candidate, range)) continue;
      max = (max && greaterThan(max, candidate)) ? max : candidate;
    }
  }
  return max ?? INVALID;
}
