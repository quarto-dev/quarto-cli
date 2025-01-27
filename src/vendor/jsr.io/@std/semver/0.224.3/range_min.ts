// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { INVALID, MAX, MIN } from "./constants.ts";
import { satisfies } from "./satisfies.ts";
import type { Comparator, Range, SemVer } from "./types.ts";
import { lessThan } from "./less_than.ts";
import { greaterThan } from "./greater_than.ts";
import { increment } from "./increment.ts";
import { isWildcardComparator } from "./_shared.ts";

function comparatorMin(comparator: Comparator): SemVer {
  const semver = comparator;
  if (isWildcardComparator(semver)) return MIN;
  switch (comparator.operator) {
    case ">":
      return semver.prerelease && semver.prerelease.length > 0
        ? increment(semver, "pre")
        : increment(semver, "patch");
    case "!=":
    case "<=":
    case "<":
      // The min(<0.0.0) is MAX
      return greaterThan(semver, MIN) ? MIN : MAX;
    case ">=":
    case undefined:
    case "=":
      return {
        major: semver.major,
        minor: semver.minor,
        patch: semver.patch,
        prerelease: semver.prerelease,
        build: semver.build,
      };
  }
}

/**
 * The minimum valid SemVer for a given range or INVALID
 *
 * @example Usage
 * ```ts
 * import { parseRange } from "@std/semver/parse-range";
 * import { rangeMin } from "@std/semver/range-min";
 * import { equals } from "@std/semver/equals";
 * import { assert } from "@std/assert/assert";
 *
 * assert(equals(rangeMin(parseRange(">=1.0.0 <2.0.0")), { major: 1, minor: 0, patch: 0 }));
 * ```
 *
 * @param range The range to calculate the min for
 * @returns A valid SemVer or INVALID
 *
 * @deprecated This will be removed in 1.0.0. Use {@linkcode greaterThanRange} or
 * {@linkcode lessThanRange} for comparing ranges and SemVers. The minimum
 * version of a range is often not well defined, and therefore this API
 * shouldn't be used. See
 * {@link https://github.com/denoland/deno_std/issues/4365} for details.
 */
export function rangeMin(range: Range): SemVer {
  let min;
  for (const comparators of range) {
    for (const comparator of comparators) {
      const candidate = comparatorMin(comparator);
      if (!satisfies(candidate, range)) continue;
      min = (min && lessThan(min, candidate)) ? min : candidate;
    }
  }
  return min ?? INVALID;
}
