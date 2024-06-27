// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Applies the given transformer to all values in the given record and returns a
 * new record containing the resulting keys associated to the last value that
 * produced them.
 *
 * @example
 * ```ts
 * import { mapValues } from "https://deno.land/std@$STD_VERSION/collections/map_values.ts";
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/assert/assert_equals.ts";
 *
 * const usersById = {
 *   "a5ec": { name: "Mischa" },
 *   "de4f": { name: "Kim" },
 * };
 * const namesById = mapValues(usersById, (it) => it.name);
 *
 * assertEquals(
 *   namesById,
 *   {
 *     "a5ec": "Mischa",
 *     "de4f": "Kim",
 *   },
 * );
 * ```
 */
export function mapValues<T, O, K extends string>(
  record: Readonly<Record<K, T>>,
  transformer: (value: T, key: K) => O,
): Record<K, O>;
/**
 * Applies the given transformer to all values in the given record and returns a
 * new record containing the resulting keys associated to the last value that
 * produced them.
 *
 * @example
 * ```ts
 * import { mapValues } from "https://deno.land/std@$STD_VERSION/collections/map_values.ts";
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/assert/assert_equals.ts";
 *
 * const usersById = {
 *   "a5ec": { name: "Mischa" },
 *   "de4f": { name: "Kim" },
 * };
 * const namesById = mapValues(usersById, (it) => it.name);
 *
 * assertEquals(
 *   namesById,
 *   {
 *     "a5ec": "Mischa",
 *     "de4f": "Kim",
 *   },
 * );
 * ```
 */
export function mapValues<T, O, K extends string>(
  record: Readonly<Partial<Record<K, T>>>,
  transformer: (value: T, key: K) => O,
): Partial<Record<K, O>>;
export function mapValues<T, O, K extends string>(
  record: Record<K, T>,
  transformer: (value: T, key: K) => O,
  // deno-lint-ignore no-explicit-any
): any {
  // deno-lint-ignore no-explicit-any
  const ret: any = {};
  const entries = Object.entries<T>(record);

  for (const [key, value] of entries) {
    const mappedValue = transformer(value, key as K);

    ret[key] = mappedValue;
  }

  return ret;
}
