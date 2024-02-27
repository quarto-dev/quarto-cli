// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { AssertionError } from "./assertion_error.ts";

/**
 * Use this to stub out methods that will throw when invoked.
 *
 * @example
 * ```ts
 * import { unimplemented } from "https://deno.land/std@$STD_VERSION/assert/unimplemented.ts";
 *
 * unimplemented(); // Throws
 * ```
 */
export function unimplemented(msg?: string): never {
  const msgSuffix = msg ? `: ${msg}` : ".";
  throw new AssertionError(`Unimplemented${msgSuffix}`);
}
