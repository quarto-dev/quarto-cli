// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import type { SemVer } from "./types.ts";
import { parseBuild, parseNumber, parsePrerelease } from "./_shared.ts";
import { FULL_REGEXP, MAX_LENGTH } from "./_shared.ts";

/**
 * Attempt to parse a string as a semantic version, returning either a `SemVer`
 * object or throws a TypeError.
 *
 * @example Usage
 * ```ts
 * import { parse } from "@std/semver/parse";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const version = parse("1.2.3");
 * assertEquals(version, {
 *   major: 1,
 *   minor: 2,
 *   patch: 3,
 *   prerelease: [],
 *   build: [],
 * });
 * ```
 *
 * @param version The version string to parse
 * @returns A valid SemVer
 */
export function parse(version: string): SemVer {
  if (typeof version !== "string") {
    throw new TypeError(
      `version must be a string`,
    );
  }

  if (version.length > MAX_LENGTH) {
    throw new TypeError(
      `version is longer than ${MAX_LENGTH} characters`,
    );
  }

  version = version.trim();

  const groups = version.match(FULL_REGEXP)?.groups;
  if (!groups) throw new TypeError(`Invalid Version: ${version}`);

  const major = parseNumber(groups.major!, "Invalid major version");
  const minor = parseNumber(groups.minor!, "Invalid minor version");
  const patch = parseNumber(groups.patch!, "Invalid patch version");

  const prerelease = groups.prerelease
    ? parsePrerelease(groups.prerelease)
    : [];
  const build = groups.buildmetadata ? parseBuild(groups.buildmetadata) : [];

  return {
    major,
    minor,
    patch,
    prerelease,
    build,
  };
}
