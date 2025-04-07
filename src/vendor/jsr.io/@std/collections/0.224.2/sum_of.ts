// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Applies the given selector to all elements in the given collection and
 * calculates the sum of the results.
 *
 * @template T The type of the array elements.
 *
 * @param array The array to calculate the sum of.
 * @param selector The selector function to get the value to sum.
 *
 * @returns The sum of all elements in the collection.
 *
 * @example Basic usage
 * ```ts
 * import { sumOf } from "@std/collections/sum-of";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const people = [
 *   { name: "Anna", age: 34 },
 *   { name: "Kim", age: 42 },
 *   { name: "John", age: 23 },
 * ];
 *
 * const totalAge = sumOf(people, (person) => person.age);
 *
 * assertEquals(totalAge, 99);
 * ```
 */
export function sumOf<T>(
  array: Iterable<T>,
  selector: (el: T) => number,
): number {
  let sum = 0;

  for (const i of array) {
    sum += selector(i);
  }

  return sum;
}
