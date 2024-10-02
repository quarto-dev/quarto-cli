// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import type { Comparator, Range, SemVer } from "./types.ts";
import { testComparatorSet } from "./_test_comparator_set.ts";
import { isWildcardComparator } from "./_shared.ts";
import { compare } from "./compare.ts";

/**
 * Check if the SemVer is greater than the range.
 *
 * @example Usage
 * ```ts
 * import { parse, parseRange, greaterThanRange } from "@std/semver";
 * import { assert, assertFalse } from "@std/assert";
 *
 * const v0 = parse("1.2.3");
 * const v1 = parse("1.2.4");
 * const range = parseRange(">=1.2.3 <1.2.4");
 * assertFalse(greaterThanRange(v0, range));
 * assert(greaterThanRange(v1, range));
 * ```
 *
 * @param semver The version to check.
 * @param range The range to check against.
 * @returns `true` if the semver is greater than the range, `false` otherwise.
 */
export function greaterThanRange(semver: SemVer, range: Range): boolean {
  return range.every((comparatorSet) =>
    greaterThanComparatorSet(semver, comparatorSet)
  );
}

function greaterThanComparatorSet(
  semver: SemVer,
  comparatorSet: Comparator[],
): boolean {
  // If the comparator set contains wildcard, then the semver is not greater than the range.
  if (comparatorSet.some(isWildcardComparator)) return false;
  // If the semver satisfies the comparator set, then it's not greater than the range.
  if (testComparatorSet(semver, comparatorSet)) return false;
  // If the semver is less than any of the comparator set, then it's not greater than the range.
  if (
    comparatorSet.some((comparator) => lessThanComparator(semver, comparator))
  ) return false;
  return true;
}

function lessThanComparator(semver: SemVer, comparator: Comparator): boolean {
  const cmp = compare(semver, comparator);
  switch (comparator.operator) {
    case "=":
    case undefined:
      return cmp < 0;
    case "!=":
      return false;
    case ">":
      return cmp <= 0;
    case "<":
      return false;
    case ">=":
      return cmp < 0;
    case "<=":
      return false;
  }
}
