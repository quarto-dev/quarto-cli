// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import type { SemVer } from "./types.ts";
import {
  checkIdentifier,
  compareIdentifier,
  compareNumber,
} from "./_shared.ts";

/**
 * Compare two semantic version objects.
 *
 * Returns `0` if `s0 === s1`, or `1` if `s0` is greater, or `-1` if `s1` is
 * greater.
 *
 * Sorts in ascending order if passed to `Array.sort()`,
 *
 * @example Usage
 * ```ts
 * import { parse, compare } from "@std/semver";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const s0 = parse("1.2.3");
 * const s1 = parse("1.2.4");
 *
 * assertEquals(compare(s0, s1), -1);
 * assertEquals(compare(s1, s0), 1);
 * assertEquals(compare(s0, s0), 0);
 * ```
 *
 * @param s0 The first SemVer to compare
 * @param s1 The second SemVer to compare
 * @returns `1` if `s0` is greater, `0` if equal, or `-1` if `s1` is greater
 */
export function compare(
  s0: SemVer,
  s1: SemVer,
): 1 | 0 | -1 {
  if (s0 === s1) return 0;
  return (
    compareNumber(s0.major, s1.major) ||
    compareNumber(s0.minor, s1.minor) ||
    compareNumber(s0.patch, s1.patch) ||
    checkIdentifier(s0.prerelease, s1.prerelease) ||
    compareIdentifier(s0.prerelease, s1.prerelease)
  );
}
