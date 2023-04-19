// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns the first element that is the largest value of the given function or
 * undefined if there are no elements.
 *
 * @example
 * ```ts
 * import { maxBy } from "https://deno.land/std@$STD_VERSION/collections/max_by.ts";
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * const people = [
 *   { name: "Anna", age: 34 },
 *   { name: "Kim", age: 42 },
 *   { name: "John", age: 23 },
 * ];
 *
 * const personWithMaxAge = maxBy(people, (i) => i.age);
 *
 * assertEquals(personWithMaxAge, { name: "Kim", age: 42 });
 * ```
 */
export function maxBy<T>(
  array: readonly T[],
  selector: (el: T) => number,
): T | undefined;
export function maxBy<T>(
  array: readonly T[],
  selector: (el: T) => string,
): T | undefined;
export function maxBy<T>(
  array: readonly T[],
  selector: (el: T) => bigint,
): T | undefined;
export function maxBy<T>(
  array: readonly T[],
  selector: (el: T) => Date,
): T | undefined;
export function maxBy<T>(
  array: readonly T[],
  selector:
    | ((el: T) => number)
    | ((el: T) => string)
    | ((el: T) => bigint)
    | ((el: T) => Date),
): T | undefined {
  let max: T | undefined = undefined;
  let maxValue: ReturnType<typeof selector> | undefined = undefined;

  for (const current of array) {
    const currentValue = selector(current);

    if (maxValue === undefined || currentValue > maxValue) {
      max = current;
      maxValue = currentValue;
    }
  }

  return max;
}
