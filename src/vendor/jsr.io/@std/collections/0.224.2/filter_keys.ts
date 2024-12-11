// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns a new record with all entries of the given record except the ones that
 * have a key that does not match the given predicate.
 *
 * @template T The type of the values in the input record.
 *
 * @param record The record to filter keys from.
 * @param predicate The function to test each key for a condition.
 *
 * @returns A new record with all entries that have a key that matches the given
 * predicate.
 *
 * @example Basic usage
 * ```ts
 * import { filterKeys } from "@std/collections/filter-keys";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const menu = {
 *   Salad: 11,
 *   Soup: 8,
 *   Pasta: 13,
 * };
 *
 * const menuWithoutSalad = filterKeys(menu, (item) => item !== "Salad");
 *
 * assertEquals(
 *   menuWithoutSalad,
 *   {
 *     Soup: 8,
 *     Pasta: 13,
 *   },
 * );
 * ```
 */
export function filterKeys<T>(
  record: Readonly<Record<string, T>>,
  predicate: (key: string) => boolean,
): Record<string, T> {
  const result: Record<string, T> = {};

  for (const [key, value] of Object.entries(record)) {
    if (predicate(key)) {
      result[key] = value;
    }
  }

  return result;
}
