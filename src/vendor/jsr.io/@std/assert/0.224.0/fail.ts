// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { assert } from "./assert.ts";

/**
 * Forcefully throws a failed assertion.
 *
 * @example
 * ```ts
 * import { fail } from "@std/assert/fail";
 *
 * fail("Deliberately failed!"); // Throws
 * ```
 */
export function fail(msg?: string): never {
  const msgSuffix = msg ? `: ${msg}` : ".";
  assert(false, `Failed assertion${msgSuffix}`);
}
