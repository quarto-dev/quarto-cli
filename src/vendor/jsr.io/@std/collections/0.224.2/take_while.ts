// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns all elements in the given collection until the first element that
 * does not match the given predicate.
 *
 * @template T The type of the array elements.
 *
 * @param array The array to take elements from.
 * @param predicate The predicate function to determine if an element should be
 * included.
 *
 * @returns A new array containing all elements until the first element that
 * does not match the predicate.
 *
 * @example Basic usage
 * ```ts
 * import { takeWhile } from "@std/collections/take-while";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const numbers = [1, 2, 3, 4, 5, 6];
 *
 * const result = takeWhile(numbers, (number) => number < 4);
 *
 * assertEquals(result, [1, 2, 3]);
 * ```
 */
export function takeWhile<T>(
  array: readonly T[],
  predicate: (el: T) => boolean,
): T[] {
  let offset = 0;
  const length = array.length;

  while (length > offset && predicate(array[offset] as T)) {
    offset++;
  }

  return array.slice(0, offset);
}
