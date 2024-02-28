// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { ReleaseType, SemVer } from "./types.ts";
import { compareIdentifier } from "./_shared.ts";

/**
 * Returns difference between two versions by the release type, or `undefined` if the versions are the same.
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
