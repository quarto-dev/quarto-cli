// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { AssertionError } from "./assertion_error.ts";

/**
 * Use this to assert unreachable code.
 *
 * @example
 * ```ts
 * import { unreachable } from "@std/assert/unreachable";
 *
 * unreachable(); // Throws
 * ```
 */
export function unreachable(reason?: string): never {
  throw new AssertionError(reason ?? "unreachable");
}
