// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns an array excluding all given values.
 *
 * @template T The type of the array elements.
 *
 * @param array The array to exclude values from.
 * @param values The values to exclude from the array.
 *
 * @returns A new array containing all elements from the given array except the
 * ones that are in the values array.
 *
 * @example Basic usage
 * ```ts
 * import { withoutAll } from "@std/collections/without-all";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const withoutList = withoutAll([2, 1, 2, 3], [1, 2]);
 *
 * assertEquals(withoutList, [3]);
 * ```
 */
export function withoutAll<T>(array: readonly T[], values: readonly T[]): T[] {
  const toExclude = new Set(values);
  return array.filter((it) => !toExclude.has(it));
}
