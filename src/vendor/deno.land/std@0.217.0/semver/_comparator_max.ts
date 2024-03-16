// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Comparator, SemVer } from "./types.ts";
import { ANY, INVALID, MAX } from "./constants.ts";

/**
 * The maximum version that could match this comparator.
 *
 * If an invalid comparator is given such as <0.0.0 then
 * an out of range semver will be returned.
 * @returns the version, the MAX version or the next smallest patch version
 */
export function comparatorMax(comparator: Comparator): SemVer {
  const semver = comparator.semver ?? comparator;
  if (semver === ANY) return MAX;
  switch (comparator.operator) {
    case "!=":
    case "!==":
    case ">":
    case ">=":
      return MAX;
    case "":
    case "==":
    case "===":
    case undefined:
    case "=":
    case "<=":
      return {
        major: semver.major,
        minor: semver.minor,
        patch: semver.patch,
        prerelease: semver.prerelease,
        build: semver.build,
      };
    case "<": {
      const patch = semver.patch - 1;
      const minor = patch >= 0 ? semver.minor : semver.minor - 1;
      const major = minor >= 0 ? semver.major : semver.major - 1;
      // if you try to do <0.0.0 it will Give you -∞.∞.∞
      // which means no SemVer can compare successfully to it.
      if (major < 0) {
        return INVALID;
      } else {
        return {
          major,
          minor: minor >= 0 ? minor : Number.POSITIVE_INFINITY,
          patch: patch >= 0 ? patch : Number.POSITIVE_INFINITY,
          prerelease: [],
          build: [],
        };
      }
    }
  }
}
