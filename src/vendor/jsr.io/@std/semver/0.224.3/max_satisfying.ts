// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import type { Range, SemVer } from "./types.ts";
import { satisfies } from "./satisfies.ts";
import { greaterThan } from "./greater_than.ts";

/**
 * Returns the highest version in the list that satisfies the range, or `undefined`
 * if none of them do.
 *
 * @example Usage
 * ```ts
 * import { parse, parseRange, maxSatisfying } from "@std/semver";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const versions = ["1.2.3", "1.2.4", "1.3.0", "2.0.0", "2.1.0"].map(parse);
 * const range = parseRange(">=1.0.0 <2.0.0");
 *
 * assertEquals(maxSatisfying(versions, range), parse("1.3.0"));
 * ```
 *
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
    if (!satisfies(version, range)) continue;
    max = max && greaterThan(max, version) ? max : version;
  }
  return max;
}
