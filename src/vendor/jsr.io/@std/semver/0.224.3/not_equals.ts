// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import type { SemVer } from "./types.ts";
import { compare } from "./compare.ts";

/**
 * Not equal comparison
 *
 * This is equal to `compare(s0, s1) !== 0`.
 *
 * @example Usage
 * ```ts
 * import { parse, notEquals } from "@std/semver";
 * import { assert, assertFalse } from "@std/assert";
 *
 * const s0 = parse("1.2.3");
 * const s1 = parse("1.2.4");
 * assert(notEquals(s0, s1));
 * assertFalse(notEquals(s0, s0));
 * ```
 *
 * @param s0 The first version to compare
 * @param s1 The second version to compare
 * @returns `true` if `s0` is not equal to `s1`, `false` otherwise
 */
export function notEquals(s0: SemVer, s1: SemVer): boolean {
  return compare(s0, s1) !== 0;
}
