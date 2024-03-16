// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { type Comparator } from "./types.ts";

export function compareNumber(
  a: number,
  b: number,
): 1 | 0 | -1 {
  if (isNaN(a) || isNaN(b)) throw new Error("Comparison against non-numbers");
  return a === b ? 0 : a < b ? -1 : 1;
}

export function checkIdentifier(
  v1: ReadonlyArray<string | number> = [],
  v2: ReadonlyArray<string | number> = [],
): 1 | 0 | -1 {
  // NOT having a prerelease is > having one
  // But NOT having a build is < having one
  if (v1.length && !v2.length) return -1;
  if (!v1.length && v2.length) return 1;
  return 0;
}

export function compareIdentifier(
  v1: ReadonlyArray<string | number> = [],
  v2: ReadonlyArray<string | number> = [],
): 1 | 0 | -1 {
  const length = Math.max(v1.length, v2.length);
  for (let i = 0; i < length; i++) {
    const a = v1[i];
    const b = v2[i];
    // same length is equal
    if (a === undefined && b === undefined) return 0;
    // longer > shorter
    if (b === undefined) return 1;
    // shorter < longer
    if (a === undefined) return -1;
    // string > number
    if (typeof a === "string" && typeof b === "number") return 1;
    // number < string
    if (typeof a === "number" && typeof b === "string") return -1;
    if (a < b) return -1;
    if (a > b) return 1;
    // If they're equal, continue comparing segments.
  }
  return 0;
}

/**
 * A single `0`, or a non-zero digit followed by zero or more digits.
 */
const NUMERIC_IDENTIFIER = "0|[1-9]\\d*";

/**
 * Zero or more digits, followed by a letter or hyphen, and then zero or more letters, digits, or hyphens.
 */
const NON_NUMERIC_IDENTIFIER = "\\d*[a-zA-Z-][a-zA-Z0-9-]*";

/**
 * Three dot-separated numeric identifiers.
 */
const VERSION_CORE =
  `(?<major>${NUMERIC_IDENTIFIER})\\.(?<minor>${NUMERIC_IDENTIFIER})\\.(?<patch>${NUMERIC_IDENTIFIER})`;

/**
 * A numeric identifier, or a non-numeric identifier.
 */
const PRERELEASE_IDENTIFIER =
  `(?:${NUMERIC_IDENTIFIER}|${NON_NUMERIC_IDENTIFIER})`;

/**
 * A hyphen, followed by one or more dot-separated pre-release version identifiers.
 * @example "-pre.release"
 */
const PRERELEASE =
  `(?:-(?<prerelease>${PRERELEASE_IDENTIFIER}(?:\\.${PRERELEASE_IDENTIFIER})*))`;

/**
 * Any combination of digits, letters, or hyphens.
 */
const BUILD_IDENTIFIER = "[0-9A-Za-z-]+";

/**
 * A plus sign, followed by one or more period-separated build metadata identifiers.
 * @example "+build.meta"
 */
const BUILD =
  `(?:\\+(?<buildmetadata>${BUILD_IDENTIFIER}(?:\\.${BUILD_IDENTIFIER})*))`;

/**
 * A version, followed optionally by a pre-release version and build metadata.
 */
const FULL_VERSION = `v?${VERSION_CORE}${PRERELEASE}?${BUILD}?`;

export const FULL_REGEXP = new RegExp(`^${FULL_VERSION}$`);

/**
 * A comparator.
 * @example `=`, `<`, `<=`, `>`, `>=`
 */
const COMPARATOR = "(?:<|>)?=?";

/**
 * A wildcard identifier.
 * @example "x", "X", "*"
 */
const WILDCARD_IDENTIFIER = `x|X|\\*`;

const XRANGE_IDENTIFIER = `${NUMERIC_IDENTIFIER}|${WILDCARD_IDENTIFIER}`;

/**
 * A version that can contain wildcards.
 * @example "x", "1.x", "1.x.x", "1.2.x", "*", "1.*", "1.*.*", "1.2.*"
 */
export const XRANGE =
  `[v=\\s]*(?<major>${XRANGE_IDENTIFIER})(?:\\.(?<minor>${XRANGE_IDENTIFIER})(?:\\.(?<patch>${XRANGE_IDENTIFIER})${PRERELEASE}?${BUILD}?)?)?`;

/**
 * An operator (`~`, `~>`, `^`, `=`, `<`, `<=`, `>`, or `>=`), followed by an x-range.
 * @example "~1.x.x", "^1.2.*", ">=1.2.3"
 */
export const OPERATOR_XRANGE_REGEXP = new RegExp(
  `^(?<operator>~>?|\\^|${COMPARATOR})\\s*${XRANGE}$`,
);

/**
 * An empty string or a comparator (`=`, `<`, `<=`, `>`, or `>=`), followed by a version.
 * @example ">1.2.3"
 */
export const COMPARATOR_REGEXP = new RegExp(
  `^(?<operator>${COMPARATOR})\\s*(${FULL_VERSION})$|^$`,
);

/**
 * Returns true if the value is a valid SemVer number.
 *
 * Must be a number. Must not be NaN. Can be positive or negative infinity.
 * Can be between 0 and MAX_SAFE_INTEGER.
 * @param value The value to check
 * @returns True if its a valid semver number
 */
export function isValidNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    !Number.isNaN(value) &&
    (!Number.isFinite(value) ||
      (0 <= value && value <= Number.MAX_SAFE_INTEGER))
  );
}

export const MAX_LENGTH = 256;

/**
 * Returns true if the value is a valid semver pre-release or build identifier.
 *
 * Must be a string. Must be between 1 and 256 characters long. Must match
 * the regular expression /[0-9A-Za-z-]+/.
 * @param value The value to check
 * @returns True if the value is a valid semver string.
 */
export function isValidString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_LENGTH &&
    /[0-9A-Za-z-]+/.test(value)
  );
}

const NUMERIC_IDENTIFIER_REGEXP = new RegExp(`^${NUMERIC_IDENTIFIER}$`);
export function parsePrerelease(prerelease: string) {
  return prerelease
    .split(".")
    .filter(Boolean)
    .map((id: string) => {
      if (NUMERIC_IDENTIFIER_REGEXP.test(id)) {
        const number = Number(id);
        if (isValidNumber(number)) return number;
      }
      return id;
    });
}

export function parseBuild(buildmetadata: string) {
  return buildmetadata.split(".").filter(Boolean);
}

export function parseNumber(input: string, errorMessage: string) {
  const number = Number(input);
  if (!isValidNumber(number)) throw new TypeError(errorMessage);
  return number;
}

export function isWildcardComparator(c: Comparator): boolean {
  return (
    Number.isNaN(c.major) && Number.isNaN(c.minor) && Number.isNaN(c.patch) &&
    (c.prerelease === undefined || c.prerelease.length === 0) &&
    (c.build === undefined || c.build.length === 0)
  );
}
