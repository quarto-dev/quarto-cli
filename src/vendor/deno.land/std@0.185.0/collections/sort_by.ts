// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns all elements in the given collection, sorted by their result using
 * the given selector. The selector function is called only once for each
 * element.
 *
 * @example
 * ```ts
 * import { sortBy } from "https://deno.land/std@$STD_VERSION/collections/sort_by.ts";
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * const people = [
 *   { name: "Anna", age: 34 },
 *   { name: "Kim", age: 42 },
 *   { name: "John", age: 23 },
 * ];
 * const sortedByAge = sortBy(people, (it) => it.age);
 *
 * assertEquals(sortedByAge, [
 *   { name: "John", age: 23 },
 *   { name: "Anna", age: 34 },
 *   { name: "Kim", age: 42 },
 * ]);
 * ```
 */
export function sortBy<T>(
  array: readonly T[],
  selector: (el: T) => number,
): T[];
export function sortBy<T>(
  array: readonly T[],
  selector: (el: T) => string,
): T[];
export function sortBy<T>(
  array: readonly T[],
  selector: (el: T) => bigint,
): T[];
export function sortBy<T>(
  array: readonly T[],
  selector: (el: T) => Date,
): T[];
export function sortBy<T>(
  array: readonly T[],
  selector:
    | ((el: T) => number)
    | ((el: T) => string)
    | ((el: T) => bigint)
    | ((el: T) => Date),
): T[] {
  const len = array.length;
  const indexes = new Array<number>(len);
  const selectors = new Array<ReturnType<typeof selector> | null>(len);

  for (let i = 0; i < len; i++) {
    indexes[i] = i;
    const s = selector(array[i]);
    selectors[i] = Number.isNaN(s) ? null : s;
  }

  indexes.sort((ai, bi) => {
    const a = selectors[ai];
    const b = selectors[bi];
    if (a === null) return 1;
    if (b === null) return -1;
    return a > b ? 1 : a < b ? -1 : 0;
  });

  for (let i = 0; i < len; i++) {
    (indexes as unknown as T[])[i] = array[indexes[i]];
  }

  return indexes as unknown as T[];
}
