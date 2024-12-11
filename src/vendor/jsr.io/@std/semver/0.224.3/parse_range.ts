// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import {
  COMPARATOR_REGEXP,
  OPERATOR_XRANGE_REGEXP,
  parseBuild,
  parseNumber,
  parsePrerelease,
  XRANGE,
} from "./_shared.ts";
import { ALL, ANY, NONE } from "./constants.ts";
import type { Comparator, Operator, Range } from "./types.ts";

type ComparatorRegExpGroup = {
  operator: Operator;
  major: string;
  minor: string;
  patch: string;
  prerelease: string;
  buildmetadata: string;
};

function parseComparator(comparator: string): Comparator {
  const match = comparator.match(COMPARATOR_REGEXP);
  const groups = match?.groups;

  if (!groups) return NONE;

  const { operator, prerelease, buildmetadata } =
    groups as ComparatorRegExpGroup;

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

  return { operator: operator || undefined, ...semver };
}

function isWildcard(id?: string): boolean {
  return !id || id.toLowerCase() === "x" || id === "*";
}

type RangeRegExpGroups = {
  operator: string;
  major: string;
  minor: string;
  patch: string;
  prerelease?: string;
  build?: string;
};

function handleLeftHyphenRangeGroups(
  leftGroup: RangeRegExpGroups,
): Comparator | undefined {
  if (isWildcard(leftGroup.major)) return;
  if (isWildcard(leftGroup.minor)) {
    return {
      operator: ">=",
      major: +leftGroup.major,
      minor: 0,
      patch: 0,
      prerelease: [],
      build: [],
    };
  }
  if (isWildcard(leftGroup.patch)) {
    return {
      operator: ">=",
      major: +leftGroup.major,
      minor: +leftGroup.minor,
      patch: 0,
      prerelease: [],
      build: [],
    };
  }
  return {
    operator: ">=",
    major: +leftGroup.major,
    minor: +leftGroup.minor,
    patch: +leftGroup.patch,
    prerelease: leftGroup.prerelease
      ? parsePrerelease(leftGroup.prerelease)
      : [],
    build: [],
  };
}
function handleRightHyphenRangeGroups(
  rightGroups: RangeRegExpGroups,
): Comparator | undefined {
  if (isWildcard(rightGroups.major)) {
    return;
  }
  if (isWildcard(rightGroups.minor)) {
    return {
      operator: "<",
      major: +rightGroups.major! + 1,
      minor: 0,
      patch: 0,
      prerelease: [],
      build: [],
    };
  }
  if (isWildcard(rightGroups.patch)) {
    return {
      operator: "<",
      major: +rightGroups.major,
      minor: +rightGroups.minor! + 1,
      patch: 0,
      prerelease: [],
      build: [],
    };
  }
  if (rightGroups.prerelease) {
    return {
      operator: "<=",
      major: +rightGroups.major,
      minor: +rightGroups.minor,
      patch: +rightGroups.patch,
      prerelease: parsePrerelease(rightGroups.prerelease),
      build: [],
    };
  }
  return {
    operator: "<=",
    major: +rightGroups.major,
    minor: +rightGroups.minor,
    patch: +rightGroups.patch,
    prerelease: rightGroups.prerelease
      ? parsePrerelease(rightGroups.prerelease)
      : [],
    build: [],
  };
}
function parseHyphenRange(range: string): Comparator[] | undefined {
  const leftMatch = range.match(new RegExp(`^${XRANGE}`));
  const leftGroup = leftMatch?.groups;
  if (!leftGroup) return;
  const leftLength = leftMatch[0].length;

  const hyphenMatch = range.slice(leftLength).match(/^\s+-\s+/);
  if (!hyphenMatch) return;
  const hyphenLength = hyphenMatch[0].length;

  const rightMatch = range.slice(leftLength + hyphenLength).match(
    new RegExp(`^${XRANGE}\\s*$`),
  );
  const rightGroups = rightMatch?.groups;
  if (!rightGroups) return;

  const from = handleLeftHyphenRangeGroups(leftGroup as RangeRegExpGroups);
  const to = handleRightHyphenRangeGroups(rightGroups as RangeRegExpGroups);
  return [from, to].filter(Boolean) as Comparator[];
}

function handleCaretOperator(groups: RangeRegExpGroups): Comparator[] {
  const majorIsWildcard = isWildcard(groups.major);
  const minorIsWildcard = isWildcard(groups.minor);
  const patchIsWildcard = isWildcard(groups.patch);

  const major = +groups.major;
  const minor = +groups.minor;
  const patch = +groups.patch;

  if (majorIsWildcard) return [ALL];
  if (minorIsWildcard) {
    return [
      { operator: ">=", major, minor: 0, patch: 0 },
      { operator: "<", major: major + 1, minor: 0, patch: 0 },
    ];
  }
  if (patchIsWildcard) {
    if (major === 0) {
      return [
        { operator: ">=", major, minor, patch: 0 },
        { operator: "<", major, minor: minor + 1, patch: 0 },
      ];
    }
    return [
      { operator: ">=", major, minor, patch: 0 },
      { operator: "<", major: major + 1, minor: 0, patch: 0 },
    ];
  }

  const prerelease = parsePrerelease(groups.prerelease ?? "");
  if (major === 0) {
    if (minor === 0) {
      return [
        { operator: ">=", major, minor, patch, prerelease },
        { operator: "<", major, minor, patch: patch + 1 },
      ];
    }
    return [
      { operator: ">=", major, minor, patch, prerelease },
      { operator: "<", major, minor: minor + 1, patch: 0 },
    ];
  }
  return [
    { operator: ">=", major, minor, patch, prerelease },
    { operator: "<", major: major + 1, minor: 0, patch: 0 },
  ];
}
function handleTildeOperator(groups: RangeRegExpGroups): Comparator[] {
  const majorIsWildcard = isWildcard(groups.major);
  const minorIsWildcard = isWildcard(groups.minor);
  const patchIsWildcard = isWildcard(groups.patch);

  const major = +groups.major;
  const minor = +groups.minor;
  const patch = +groups.patch;

  if (majorIsWildcard) return [ALL];
  if (minorIsWildcard) {
    return [
      { operator: ">=", major, minor: 0, patch: 0 },
      { operator: "<", major: major + 1, minor: 0, patch: 0 },
    ];
  }
  if (patchIsWildcard) {
    return [
      { operator: ">=", major, minor, patch: 0 },
      { operator: "<", major, minor: minor + 1, patch: 0 },
    ];
  }
  const prerelease = parsePrerelease(groups.prerelease ?? "");
  return [
    { operator: ">=", major, minor, patch, prerelease },
    { operator: "<", major, minor: minor + 1, patch: 0 },
  ];
}
function handleLessThanOperator(groups: RangeRegExpGroups): Comparator[] {
  const majorIsWildcard = isWildcard(groups.major);
  const minorIsWildcard = isWildcard(groups.minor);
  const patchIsWildcard = isWildcard(groups.patch);

  const major = +groups.major;
  const minor = +groups.minor;
  const patch = +groups.patch;

  if (majorIsWildcard) return [{ operator: "<", major: 0, minor: 0, patch: 0 }];
  if (minorIsWildcard) {
    if (patchIsWildcard) return [{ operator: "<", major, minor: 0, patch: 0 }];
    return [{ operator: "<", major, minor, patch: 0 }];
  }
  if (patchIsWildcard) return [{ operator: "<", major, minor, patch: 0 }];
  const prerelease = parsePrerelease(groups.prerelease ?? "");
  const build = parseBuild(groups.build ?? "");
  return [{ operator: "<", major, minor, patch, prerelease, build }];
}
function handleLessThanOrEqualOperator(
  groups: RangeRegExpGroups,
): Comparator[] {
  const minorIsWildcard = isWildcard(groups.minor);
  const patchIsWildcard = isWildcard(groups.patch);

  const major = +groups.major;
  const minor = +groups.minor;
  const patch = +groups.patch;

  if (minorIsWildcard) {
    if (patchIsWildcard) {
      return [{ operator: "<", major: major + 1, minor: 0, patch: 0 }];
    }
    return [{ operator: "<", major, minor: minor + 1, patch: 0 }];
  }
  if (patchIsWildcard) {
    return [{ operator: "<", major, minor: minor + 1, patch: 0 }];
  }
  const prerelease = parsePrerelease(groups.prerelease ?? "");
  const build = parseBuild(groups.build ?? "");
  return [{ operator: "<=", major, minor, patch, prerelease, build }];
}
function handleGreaterThanOperator(groups: RangeRegExpGroups): Comparator[] {
  const majorIsWildcard = isWildcard(groups.major);
  const minorIsWildcard = isWildcard(groups.minor);
  const patchIsWildcard = isWildcard(groups.patch);

  const major = +groups.major;
  const minor = +groups.minor;
  const patch = +groups.patch;

  if (majorIsWildcard) return [{ operator: "<", major: 0, minor: 0, patch: 0 }];

  if (minorIsWildcard) {
    return [{ operator: ">=", major: major + 1, minor: 0, patch: 0 }];
  }
  if (patchIsWildcard) {
    return [{ operator: ">=", major, minor: minor + 1, patch: 0 }];
  }
  const prerelease = parsePrerelease(groups.prerelease ?? "");
  const build = parseBuild(groups.build ?? "");
  return [{ operator: ">", major, minor, patch, prerelease, build }];
}
function handleGreaterOrEqualOperator(groups: RangeRegExpGroups): Comparator[] {
  const majorIsWildcard = isWildcard(groups.major);
  const minorIsWildcard = isWildcard(groups.minor);
  const patchIsWildcard = isWildcard(groups.patch);

  const major = +groups.major;
  const minor = +groups.minor;
  const patch = +groups.patch;

  if (majorIsWildcard) return [ALL];
  if (minorIsWildcard) {
    if (patchIsWildcard) return [{ operator: ">=", major, minor: 0, patch: 0 }];
    return [{ operator: ">=", major, minor, patch: 0 }];
  }
  if (patchIsWildcard) return [{ operator: ">=", major, minor, patch: 0 }];
  const prerelease = parsePrerelease(groups.prerelease ?? "");
  const build = parseBuild(groups.build ?? "");
  return [{ operator: ">=", major, minor, patch, prerelease, build }];
}
function handleEqualOperator(groups: RangeRegExpGroups): Comparator[] {
  const majorIsWildcard = isWildcard(groups.major);
  const minorIsWildcard = isWildcard(groups.minor);
  const patchIsWildcard = isWildcard(groups.patch);

  const major = +groups.major;
  const minor = +groups.minor;
  const patch = +groups.patch;

  if (majorIsWildcard) return [ALL];
  if (minorIsWildcard) {
    return [
      { operator: ">=", major, minor: 0, patch: 0 },
      { operator: "<", major: major + 1, minor: 0, patch: 0 },
    ];
  }
  if (patchIsWildcard) {
    return [
      { operator: ">=", major, minor, patch: 0 },
      { operator: "<", major, minor: minor + 1, patch: 0 },
    ];
  }
  const prerelease = parsePrerelease(groups.prerelease ?? "");
  const build = parseBuild(groups.build ?? "");
  return [{ operator: undefined, major, minor, patch, prerelease, build }];
}

function parseOperatorRange(string: string): Comparator | Comparator[] {
  const groups = string.match(OPERATOR_XRANGE_REGEXP)
    ?.groups as RangeRegExpGroups;
  if (!groups) return parseComparator(string);

  switch (groups.operator) {
    case "^":
      return handleCaretOperator(groups);
    case "~":
    case "~>":
      return handleTildeOperator(groups);
    case "<":
      return handleLessThanOperator(groups);
    case "<=":
      return handleLessThanOrEqualOperator(groups);
    case ">":
      return handleGreaterThanOperator(groups);
    case ">=":
      return handleGreaterOrEqualOperator(groups);
    case "=":
    case "":
      return handleEqualOperator(groups);
    default:
      throw new Error(`'${groups.operator}' is not a valid operator.`);
  }
}
function parseOperatorRanges(string: string): Comparator[] {
  return string.split(/\s+/).flatMap(parseOperatorRange);
}

/**
 * Parses a range string into a Range object or throws a TypeError.
 *
 * @example Usage
 * ```ts
 * import { parseRange } from "@std/semver/parse-range";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const range = parseRange(">=1.0.0 <2.0.0 || >=3.0.0");
 * assertEquals(range, [
 *   [
 *     { operator: ">=", major: 1, minor: 0, patch: 0, prerelease: [], build: [] },
 *     { operator: "<", major: 2, minor: 0, patch: 0, prerelease: [], build: [] },
 *   ],
 *   [
 *     { operator: ">=", major: 3, minor: 0, patch: 0, prerelease: [], build: [] },
 *   ]
 * ]);
 * ```
 *
 * @param range The range set string
 * @returns A valid semantic range
 */
export function parseRange(range: string): Range {
  return range
    // remove spaces between operators and versions
    .replaceAll(/(?<=<|>|=) +/g, "")
    .split(/\s*\|\|\s*/)
    .map((string) => parseHyphenRange(string) || parseOperatorRanges(string));
}
