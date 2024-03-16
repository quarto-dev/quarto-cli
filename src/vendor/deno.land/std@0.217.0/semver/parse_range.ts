// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { ALL } from "./constants.ts";
import type { Comparator, Range } from "./types.ts";
import { OPERATOR_XRANGE_REGEXP, XRANGE } from "./_shared.ts";
import { parseComparator } from "./_parse_comparator.ts";
import { parseBuild, parsePrerelease } from "./_shared.ts";

function isWildcard(id?: string): boolean {
  return !id || id.toLowerCase() === "x" || id === "*";
}

type RegExpGroups = {
  operator: string;
  major: string;
  minor: string;
  patch: string;
  prerelease?: string;
  build?: string;
};

function parseHyphenRange(range: string) {
  // remove spaces between comparator and groups
  range = range.replace(/(?<=<|>|=) +/, "");

  const leftMatch = range.match(new RegExp(`^${XRANGE}`));
  const leftGroup = leftMatch?.groups;
  if (!leftGroup) return range.split(/\s+/);
  const leftLength = leftMatch[0].length;
  const hyphenMatch = range.slice(leftLength).match(/^\s+-\s+/);
  if (!hyphenMatch) return range.split(/\s+/);
  const hyphenLength = hyphenMatch[0].length;
  const rightMatch = range.slice(leftLength + hyphenLength).match(
    new RegExp(`^${XRANGE}\\s*$`),
  );
  const rightGroups = rightMatch?.groups;
  if (!rightGroups) return range.split(/\s+/);
  let from = leftMatch[0];
  let to = rightMatch[0];

  if (isWildcard(leftGroup.major)) {
    from = "";
  } else if (isWildcard(leftGroup.minor)) {
    from = `>=${leftGroup.major}.0.0`;
  } else if (isWildcard(leftGroup.patch)) {
    from = `>=${leftGroup.major}.${leftGroup.minor}.0`;
  } else {
    from = `>=${from}`;
  }

  if (isWildcard(rightGroups.major)) {
    to = "";
  } else if (isWildcard(rightGroups.minor)) {
    to = `<${+rightGroups.major! + 1}.0.0`;
  } else if (isWildcard(rightGroups.patch)) {
    to = `<${rightGroups.major}.${+rightGroups.minor! + 1}.0`;
  } else if (rightGroups.prerelease) {
    to =
      `<=${rightGroups.major}.${rightGroups.minor}.${rightGroups.patch}-${rightGroups.prerelease}`;
  } else {
    to = `<=${to}`;
  }

  return [from, to];
}
function handleCaretOperator(groups: RegExpGroups): Comparator[] {
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
function handleTildeOperator(groups: RegExpGroups): Comparator[] {
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
function handleLessThanOperator(groups: RegExpGroups): Comparator[] {
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
function handleLessThanOrEqualOperator(groups: RegExpGroups): Comparator[] {
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
function handleGreaterThanOperator(groups: RegExpGroups): Comparator[] {
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
function handleGreaterOrEqualOperator(groups: RegExpGroups): Comparator[] {
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
function handleEqualOperator(groups: RegExpGroups): Comparator[] {
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

function parseRangeString(string: string) {
  const groups = string.match(OPERATOR_XRANGE_REGEXP)?.groups as RegExpGroups;
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

/**
 * Parses a range string into a Range object or throws a TypeError.
 * @param range The range set string
 * @returns A valid semantic range
 */
export function parseRange(range: string): Range {
  const ranges = range
    .split(/\s*\|\|\s*/)
    .map((range) => parseHyphenRange(range).flatMap(parseRangeString));
  Object.defineProperty(ranges, "ranges", { value: ranges });
  return ranges as Range;
}
