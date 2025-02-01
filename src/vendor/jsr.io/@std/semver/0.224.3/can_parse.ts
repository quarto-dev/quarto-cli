// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { parse } from "./parse.ts";

/**
 * Returns true if the string can be parsed as SemVer.
 *
 * @example Usage
 * ```ts
 * import { canParse } from "@std/semver/can-parse";
 * import { assert, assertFalse } from "@std/assert";
 *
 * assert(canParse("1.2.3"));
 * assertFalse(canParse("invalid"));
 * ```
 *
 * @param version The version string to check
 * @returns `true` if the string can be parsed as SemVer, `false` otherwise
 */
export function canParse(version: string): boolean {
  try {
    parse(version);
    return true;
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    return false;
  }
}
