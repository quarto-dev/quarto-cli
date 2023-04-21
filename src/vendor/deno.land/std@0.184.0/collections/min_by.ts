// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns the first element that is the smallest value of the given function or
 * undefined if there are no elements
 *
 * @example
 * ```ts
 * import { minBy } from "https://deno.land/std@$STD_VERSION/collections/min_by.ts";
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * const people = [
 *   { name: "Anna", age: 34 },
 *   { name: "Kim", age: 42 },
 *   { name: "John", age: 23 },
 * ];
 *
 * const personWithMinAge = minBy(people, (i) => i.age);
 *
 * assertEquals(personWithMinAge, { name: "John", age: 23 });
 * ```
 */
export function minBy<T>(
  array: readonly T[],
  selector: (el: T) => number,
): T | undefined;
export function minBy<T>(
  array: readonly T[],
  selector: (el: T) => string,
): T | undefined;
export function minBy<T>(
  array: readonly T[],
  selector: (el: T) => bigint,
): T | undefined;
export function minBy<T>(
  array: readonly T[],
  selector: (el: T) => Date,
): T | undefined;
export function minBy<T>(
  array: readonly T[],
  selector:
    | ((el: T) => number)
    | ((el: T) => string)
    | ((el: T) => bigint)
    | ((el: T) => Date),
): T | undefined {
  let min: T | undefined = undefined;
  let minValue: ReturnType<typeof selector> | undefined = undefined;

  for (const current of array) {
    const currentValue = selector(current);

    if (minValue === undefined || currentValue < minValue) {
      min = current;
      minValue = currentValue;
    }
  }

  return min;
}
