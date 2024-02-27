// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Comparator, SemVer } from "./types.ts";
import { ANY, MAX, MIN } from "./constants.ts";
import { greaterThan } from "./greater_than.ts";
import { increment } from "./increment.ts";

/**
 * The minimum semantic version that could match this comparator
 * @param comparator The semantic version of the comparator
 * @param operator The operator of the comparator
 * @returns The minimum valid semantic version
 */
export function comparatorMin(comparator: Comparator): SemVer {
  const semver = comparator.semver ?? comparator;
  if (semver === ANY) return MIN;
  switch (comparator.operator) {
    case ">":
      return semver.prerelease && semver.prerelease.length > 0
        ? increment(semver, "pre")
        : increment(semver, "patch");
    case "!=":
    case "!==":
    case "<=":
    case "<":
      // The min(<0.0.0) is MAX
      return greaterThan(semver, MIN) ? MIN : MAX;
    case ">=":
    case undefined:
    case "":
    case "=":
    case "==":
    case "===":
      return {
        major: semver.major,
        minor: semver.minor,
        patch: semver.patch,
        prerelease: semver.prerelease,
        build: semver.build,
      };
  }
}
