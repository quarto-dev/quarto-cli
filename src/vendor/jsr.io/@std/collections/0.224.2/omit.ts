// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Creates a new object by excluding the specified keys from the provided object.
 *
 * @template T The type of the object.
 * @template K The type of the keys to omit.
 *
 * @param obj The object to omit keys from.
 * @param keys The keys to omit from the object.
 *
 * @returns A new object with the specified keys omitted.
 *
 * @example Basic usage
 * ```ts
 * import { omit } from "@std/collections/omit";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const obj = { a: 5, b: 6, c: 7, d: 8 };
 * const omitted = omit(obj, ["a", "c"]);
 *
 * assertEquals(omitted, { b: 6, d: 8 });
 * ```
 */
export function omit<T extends object, K extends keyof T>(
  obj: Readonly<T>,
  keys: readonly K[],
): Omit<T, K> {
  const excludes = new Set(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([k, _]) => !excludes.has(k as K)),
  ) as Omit<T, K>;
}
