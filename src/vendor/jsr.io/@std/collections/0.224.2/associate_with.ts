// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Associates each element of an array with a value returned by a selector
 * function.
 *
 * If any of two pairs would have the same value the latest on will be used
 * (overriding the ones before it).
 *
 * @template T The type of the values returned by the selector function.
 *
 * @param array The array of elements to associate with values.
 * @param selector The selector function that returns a value for each element.
 *
 * @returns An object where each element of the array is associated with a value
 * returned by the selector function.
 *
 * @example Basic usage
 * ```ts
 * import { associateWith } from "@std/collections/associate-with";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const names = ["Kim", "Lara", "Jonathan"];
 *
 * const namesToLength = associateWith(names, (person) => person.length);
 *
 * assertEquals(namesToLength, {
 *   "Kim": 3,
 *   "Lara": 4,
 *   "Jonathan": 8,
 * });
 * ```
 */
export function associateWith<T>(
  array: Iterable<string>,
  selector: (key: string) => T,
): Record<string, T> {
  const result: Record<string, T> = {};

  for (const element of array) {
    result[element] = selector(element);
  }

  return result;
}
