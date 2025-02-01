// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import type { ReleaseType, SemVer } from "./types.ts";
import { compareIdentifier } from "./_shared.ts";

/**
 * Returns difference between two versions by the release type,
 * or `undefined` if the versions are the same.
 *
 * @example Usage
 * ```ts
 * import { parse, difference } from "@std/semver";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const s0 = parse("1.2.3");
 * const s1 = parse("1.2.4");
 * const s2 = parse("1.3.0");
 * const s3 = parse("2.0.0");
 *
 * assertEquals(difference(s0, s1), "patch");
 * assertEquals(difference(s0, s2), "minor");
 * assertEquals(difference(s0, s3), "major");
 * assertEquals(difference(s0, s0), undefined);
 * ```
 *
 * @param s0 The first SemVer to compare
 * @param s1 The second SemVer to compare
 * @returns The release type difference or `undefined` if the versions are the same
 */
export function difference(s0: SemVer, s1: SemVer): ReleaseType | undefined {
  const hasPrerelease = s0.prerelease?.length || s1.prerelease?.length;

  if (s0.major !== s1.major) return hasPrerelease ? "premajor" : "major";
  if (s0.minor !== s1.minor) return hasPrerelease ? "preminor" : "minor";
  if (s0.patch !== s1.patch) return hasPrerelease ? "prepatch" : "patch";

  if (compareIdentifier(s0.prerelease, s1.prerelease) !== 0) {
    return "prerelease";
  }
}
