// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Range, SemVer } from "./types.ts";
import { satisfies } from "./satisfies.ts";

/**
 * Test to see if the version satisfies the range.
 *
 * @example Usage
 * ```ts
 * import { parse, parseRange, testRange } from "@std/semver";
 * import { assert, assertFalse } from "@std/assert";
 *
 * const version = parse("1.2.3");
 * const range0 = parseRange(">=1.0.0 <2.0.0");
 * const range1 = parseRange(">=1.0.0 <1.3.0");
 * const range2 = parseRange(">=1.0.0 <1.2.3");
 *
 * assert(testRange(version, range0));
 * assert(testRange(version, range1));
 * assertFalse(testRange(version, range2));
 * ```
 * @param version The version to test
 * @param range The range to check
 * @returns true if the version is in the range
 *
 * @deprecated This will be removed in 1.0.0. Use {@linkcode satisfies}
 * instead. See https://github.com/denoland/deno_std/pull/4364.
 */
export function testRange(version: SemVer, range: Range): boolean {
  return satisfies(version, range);
}
