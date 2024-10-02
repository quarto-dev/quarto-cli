// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { AssertionError } from "./assertion_error.ts";

/**
 * Make an assertion that `actual` match RegExp `expected`. If not
 * then throw.
 *
 * @example
 * ```ts
 * import { assertMatch } from "@std/assert/assert-match";
 *
 * assertMatch("Raptor", RegExp(/Raptor/)); // Doesn't throw
 * assertMatch("Denosaurus", RegExp(/Raptor/)); // Throws
 * ```
 */
export function assertMatch(
  actual: string,
  expected: RegExp,
  msg?: string,
) {
  if (!expected.test(actual)) {
    const msgSuffix = msg ? `: ${msg}` : ".";
    msg = `Expected actual: "${actual}" to match: "${expected}"${msgSuffix}`;
    throw new AssertionError(msg);
  }
}
