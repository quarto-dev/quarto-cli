// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns a tuple of two arrays with the first one containing all elements in
 * the given array that match the given predicate and the second one containing
 * all that do not.
 *
 * @template T The type of the elements in the array.
 *
 * @param array The array to partition.
 * @param predicate The predicate function to determine which array an element
 * belongs to.
 *
 * @returns A tuple of two arrays. The first array contains all elements that
 * match the predicate, the second contains all elements that do not.
 *
 * @example Basic usage
 * ```ts
 * import { partition } from "@std/collections/partition";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const numbers = [5, 6, 7, 8, 9];
 * const [even, odd] = partition(numbers, (it) => it % 2 === 0);
 *
 * assertEquals(even, [6, 8]);
 * assertEquals(odd, [5, 7, 9]);
 * ```
 */
export function partition<T>(
  array: Iterable<T>,
  predicate: (el: T) => boolean,
): [T[], T[]];
/**
 * Returns a tuple of two arrays with the first one containing all elements in
 * the given array that match the given predicate and the second one containing
 * all that do not.
 *
 * This version of the function is a type-guard version of the function. It
 * allows you to specify a type-guard predicate function that narrows the type
 * of the elements in the array.
 *
 * @template T The type of the elements in the array.
 * @template U The type of the elements that match the predicate.
 *
 * @param array The array to partition.
 * @param predicate The type-guard predicate function to determine which array
 * an element belongs to.
 *
 * @returns A tuple of two arrays. The first array contains all elements that
 * match the predicate, the second contains all elements that do not.
 *
 * @example Basic usage
 * ```ts
 * import { partition } from "@std/collections/partition";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const numbers = [5, 6, 7, 8, 9];
 * const [even, odd] = partition(numbers, (it) => it % 2 === 0);
 *
 * assertEquals(even, [6, 8]);
 * assertEquals(odd, [5, 7, 9]);
 * ```
 */
export function partition<T, U extends T>(
  array: Iterable<T>,
  predicate: (el: T) => el is U,
): [U[], Exclude<T, U>[]];
export function partition(
  array: Iterable<unknown>,
  predicate: (el: unknown) => boolean,
): [unknown[], unknown[]] {
  const matches: Array<unknown> = [];
  const rest: Array<unknown> = [];

  for (const element of array) {
    if (predicate(element)) {
      matches.push(element);
    } else {
      rest.push(element);
    }
  }

  return [matches, rest];
}
