// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { INVALID, MAX } from "./constants.ts";
import { satisfies } from "./satisfies.ts";
import type { Comparator, Range, SemVer } from "./types.ts";
import { greaterThan } from "./greater_than.ts";
import { isWildcardComparator } from "./_shared.ts";

function comparatorMax(comparator: Comparator): SemVer {
  const semver = comparator;
  if (isWildcardComparator(comparator)) return MAX;
  switch (comparator.operator) {
    case "!=":
    case ">":
    case ">=":
      return MAX;
    case undefined:
    case "=":
    case "<=":
      return {
        major: semver.major,
        minor: semver.minor,
        patch: semver.patch,
        prerelease: semver.prerelease,
        build: semver.build,
      };
    case "<": {
      const patch = semver.patch - 1;
      const minor = patch >= 0 ? semver.minor : semver.minor - 1;
      const major = minor >= 0 ? semver.major : semver.major - 1;
      // if you try to do <0.0.0 it will Give you -∞.∞.∞
      // which means no SemVer can compare successfully to it.
      if (major < 0) return INVALID;

      return {
        major,
        minor: minor >= 0 ? minor : Number.POSITIVE_INFINITY,
        patch: patch >= 0 ? patch : Number.POSITIVE_INFINITY,
        prerelease: [],
        build: [],
      };
    }
  }
}

/**
 * The maximum valid SemVer for a given range or INVALID
 *
 * @example Usage
 * ```ts
 * import { parseRange } from "@std/semver/parse-range";
 * import { rangeMax } from "@std/semver/range-max";
 * import { equals } from "@std/semver/equals";
 * import { assert } from "@std/assert/assert";
 *
 * assert(equals(rangeMax(parseRange(">1.0.0 <=2.0.0")), { major: 2, minor: 0, patch: 0 }));
 * ```
 *
 * @param range The range to calculate the max for
 * @returns A valid SemVer or INVALID
 *
 * @deprecated This will be removed in 1.0.0. Use {@linkcode greaterThanRange} or
 * {@linkcode lessThanRange} for comparing ranges and SemVers. The maximum
 * version of a range is often not well defined, and therefore this API
 * shouldn't be used. See
 * {@link https://github.com/denoland/deno_std/issues/4365} for details.
 */
export function rangeMax(range: Range): SemVer {
  let max;
  for (const comparators of range) {
    for (const comparator of comparators) {
      const candidate = comparatorMax(comparator);
      if (!satisfies(candidate, range)) continue;
      max = (max && greaterThan(max, candidate)) ? max : candidate;
    }
  }
  return max ?? INVALID;
}
