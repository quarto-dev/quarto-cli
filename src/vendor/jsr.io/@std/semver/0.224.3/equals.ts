// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { compare } from "./compare.ts";
import type { SemVer } from "./types.ts";

/**
 * Returns `true` if both semantic versions are logically equivalent, even if they're not the exact same version object.
 *
 * This is equal to `compare(s0, s1) === 0`.
 *
 * @example Usage
 * ```ts
 * import { parse, equals } from "@std/semver";
 * import { assert, assertFalse } from "@std/assert";
 *
 * const s0 = parse("1.2.3");
 * const s1 = parse("1.2.3");
 *
 * assert(equals(s0, s1));
 * assertFalse(equals(s0, parse("1.2.4")));
 * ```
 *
 * @param s0 The first SemVer to compare
 * @param s1 The second SemVer to compare
 * @returns `true` if `s0` is equal to `s1`, `false` otherwise
 */
export function equals(s0: SemVer, s1: SemVer): boolean {
  return compare(s0, s1) === 0;
}
