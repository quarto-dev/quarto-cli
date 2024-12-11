// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import type { SemVer } from "./types.ts";
import { compare } from "./compare.ts";

/**
 * Greater than or equal to comparison
 *
 * This is equal to `compare(s0, s1) >= 0`.
 *
 * @example Usage
 * ```ts
 * import { parse, greaterOrEqual } from "@std/semver";
 * import { assert, assertFalse } from "@std/assert";
 *
 * const s0 = parse("1.2.3");
 * const s1 = parse("1.2.4");
 * assert(greaterOrEqual(s1, s0));
 * assertFalse(greaterOrEqual(s0, s1));
 * assert(greaterOrEqual(s0, s0));
 * ```
 *
 * @param s0 The first version to compare
 * @param s1 The second version to compare
 * @returns `true` if `s0` is greater than or equal to `s1`, `false` otherwise
 */
export function greaterOrEqual(s0: SemVer, s1: SemVer): boolean {
  return compare(s0, s1) >= 0;
}
