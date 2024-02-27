// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { AssertionError } from "./assertion_error.ts";

/**
 * Make an assertion that `actual` not match RegExp `expected`. If match
 * then throw.
 *
 * @example
 * ```ts
 * import { assertNotMatch } from "https://deno.land/std@$STD_VERSION/assert/assert_not_match.ts";
 *
 * assertNotMatch("Denosaurus", RegExp(/Raptor/)); // Doesn't throw
 * assertNotMatch("Raptor", RegExp(/Raptor/)); // Throws
 * ```
 */
export function assertNotMatch(
  actual: string,
  expected: RegExp,
  msg?: string,
) {
  if (expected.test(actual)) {
    const msgSuffix = msg ? `: ${msg}` : ".";
    msg =
      `Expected actual: "${actual}" to not match: "${expected}"${msgSuffix}`;
    throw new AssertionError(msg);
  }
}
