// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { AssertionError } from "./assertion_error.ts";

/**
 * Make an assertion that actual includes expected. If not
 * then throw.
 *
 * @example
 * ```ts
 * import { assertStringIncludes } from "@std/assert/assert-string-includes";
 *
 * assertStringIncludes("Hello", "ello"); // Doesn't throw
 * assertStringIncludes("Hello", "world"); // Throws
 * ```
 */
export function assertStringIncludes(
  actual: string,
  expected: string,
  msg?: string,
) {
  if (!actual.includes(expected)) {
    const msgSuffix = msg ? `: ${msg}` : ".";
    msg = `Expected actual: "${actual}" to contain: "${expected}"${msgSuffix}`;
    throw new AssertionError(msg);
  }
}
