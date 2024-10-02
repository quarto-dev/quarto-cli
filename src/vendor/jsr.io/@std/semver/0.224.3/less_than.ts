// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import type { SemVer } from "./types.ts";
import { compare } from "./compare.ts";

/**
 * Less than comparison
 *
 * This is equal to `compare(s0, s1) < 0`.
 *
 * @example Usage
 * ```ts
 * import { parse, lessThan } from "@std/semver";
 * import { assert, assertFalse } from "@std/assert";
 *
 * const s0 = parse("1.2.3");
 * const s1 = parse("1.2.4");
 * assert(lessThan(s0, s1));
 * assertFalse(lessThan(s1, s0));
 * assertFalse(lessThan(s0, s0));
 * ```
 *
 * @param s0 the first version to compare
 * @param s1 the second version to compare
 * @returns `true` if `s0` is less than `s1`, `false` otherwise
 */
export function lessThan(s0: SemVer, s1: SemVer): boolean {
  return compare(s0, s1) < 0;
}
