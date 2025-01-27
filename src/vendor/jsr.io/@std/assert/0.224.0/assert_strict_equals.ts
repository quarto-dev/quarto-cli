// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { buildMessage, diff, diffstr, format } from "jsr:@std/internal@^0.224.0";
import { AssertionError } from "./assertion_error.ts";
import { CAN_NOT_DISPLAY } from "./_constants.ts";
import { red } from "jsr:/@std/fmt@^0.224.0/colors";

/**
 * Make an assertion that `actual` and `expected` are strictly equal. If
 * not then throw.
 *
 * @example
 * ```ts
 * import { assertStrictEquals } from "@std/assert/assert-strict-equals";
 *
 * const a = {};
 * const b = a;
 * assertStrictEquals(a, b); // Doesn't throw
 *
 * const c = {};
 * const d = {};
 * assertStrictEquals(c, d); // Throws
 * ```
 */
export function assertStrictEquals<T>(
  actual: unknown,
  expected: T,
  msg?: string,
): asserts actual is T {
  if (Object.is(actual, expected)) {
    return;
  }

  const msgSuffix = msg ? `: ${msg}` : ".";
  let message: string;

  const actualString = format(actual);
  const expectedString = format(expected);

  if (actualString === expectedString) {
    const withOffset = actualString
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n");
    message =
      `Values have the same structure but are not reference-equal${msgSuffix}\n\n${
        red(withOffset)
      }\n`;
  } else {
    try {
      const stringDiff = (typeof actual === "string") &&
        (typeof expected === "string");
      const diffResult = stringDiff
        ? diffstr(actual as string, expected as string)
        : diff(actualString.split("\n"), expectedString.split("\n"));
      const diffMsg = buildMessage(diffResult, { stringDiff }).join("\n");
      message = `Values are not strictly equal${msgSuffix}\n${diffMsg}`;
    } catch {
      message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
    }
  }

  throw new AssertionError(message);
}
