// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Comparator, Operator } from "./types.ts";
import {
  COMPARATOR_REGEXP,
  parseBuild,
  parseNumber,
  parsePrerelease,
} from "./_shared.ts";
import { ANY, NONE } from "./constants.ts";

type REGEXP_GROUPS = {
  operator: Operator;
  major: string;
  minor: string;
  patch: string;
  prerelease: string;
  buildmetadata: string;
};

/**
 * Parses a comparator string into a valid Comparator.
 * @param comparator
 * @returns A valid Comparator
 */
export function parseComparator(comparator: string): Comparator {
  const match = comparator.match(COMPARATOR_REGEXP);
  const groups = match?.groups;

  if (!groups) return NONE;

  const { operator, prerelease, buildmetadata } = groups as REGEXP_GROUPS;

  const semver = groups.major
    ? {
      major: parseNumber(groups.major, "Invalid major version"),
      minor: parseNumber(
        groups.minor!,
        "Invalid minor version",
      ),
      patch: parseNumber(
        groups.patch!,
        "Invalid patch version",
      ),
      prerelease: prerelease ? parsePrerelease(prerelease) : [],
      build: buildmetadata ? parseBuild(buildmetadata) : [],
    }
    : ANY;

  return { operator: operator || undefined, ...semver, semver };
}
