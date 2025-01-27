// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { format } from "jsr:/@std/internal@^0.224.0/format";
import { AssertionError } from "./assertion_error.ts";

/**
 * Make an assertion that `actual` is greater than `expected`.
 * If not then throw.
 *
 * @example
 * ```ts
 * import { assertGreater } from "@std/assert/assert-greater";
 *
 * assertGreater(2, 1); // Doesn't throw
 * assertGreater(1, 1); // Throws
 * assertGreater(0, 1); // Throws
 * ```
 */
export function assertGreater<T>(actual: T, expected: T, msg?: string) {
  if (actual > expected) return;

  const actualString = format(actual);
  const expectedString = format(expected);
  throw new AssertionError(msg ?? `Expect ${actualString} > ${expectedString}`);
}
