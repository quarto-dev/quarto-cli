// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Creates a new object by including the specified keys from the provided
 * object.
 *
 * @template T The type of the object.
 * @template K The type of the keys.
 *
 * @param obj The object to pick keys from.
 * @param keys The keys to include in the new object.
 *
 * @returns A new object with the specified keys from the provided object.
 *
 * @example Basic usage
 * ```ts
 * import { pick } from "@std/collections/pick";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const obj = { a: 5, b: 6, c: 7, d: 8 };
 * const picked = pick(obj, ["a", "c"]);
 *
 * assertEquals(picked, { a: 5, c: 7 });
 * ```
 */
export function pick<T extends object, K extends keyof T>(
  obj: Readonly<T>,
  keys: readonly K[],
): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, obj[k]])) as Pick<T, K>;
}
