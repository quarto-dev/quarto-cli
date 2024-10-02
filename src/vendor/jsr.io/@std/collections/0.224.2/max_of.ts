// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Applies the given selector to all elements of the provided collection and
 * returns the max value of all elements. If an empty array is provided the
 * function will return undefined.
 *
 * @template T The type of the elements in the array.
 *
 * @param array The array to find the maximum element in.
 * @param selector The function to get the value to compare from each element.
 *
 * @returns The largest value of the given function or undefined if there are no
 * elements.
 *
 * @example Basic usage
 * ```ts
 * import { maxOf } from "@std/collections/max-of";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const inventory = [
 *   { name: "mustard", count: 2 },
 *   { name: "soy", count: 4 },
 *   { name: "tomato", count: 32 },
 * ];
 *
 * const maxCount = maxOf(inventory, (item) => item.count);
 *
 * assertEquals(maxCount, 32);
 * ```
 */
export function maxOf<T>(
  array: Iterable<T>,
  selector: (el: T) => number,
): number | undefined;
/**
 * Applies the given selector to all elements of the provided collection and
 * returns the max value of all elements. If an empty array is provided the
 * function will return undefined.
 *
 * @template T The type of the elements in the array.
 *
 * @param array The array to find the maximum element in.
 * @param selector The function to get the value to compare from each element.
 *
 * @returns The first element that is the largest value of the given function or
 * undefined if there are no elements.
 *
 * @example Basic usage
 * ```ts
 * import { maxOf } from "@std/collections/max-of";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const inventory = [
 *   { name: "mustard", count: 2n },
 *   { name: "soy", count: 4n },
 *   { name: "tomato", count: 32n },
 * ];
 *
 * const maxCount = maxOf(inventory, (i) => i.count);
 *
 * assertEquals(maxCount, 32n);
 * ```
 */
export function maxOf<T>(
  array: Iterable<T>,
  selector: (el: T) => bigint,
): bigint | undefined;
export function maxOf<T, S extends ((el: T) => number) | ((el: T) => bigint)>(
  array: Iterable<T>,
  selector: S,
): ReturnType<S> | undefined {
  let maximumValue: ReturnType<S> | undefined;

  for (const element of array) {
    const currentValue = selector(element) as ReturnType<S>;

    if (maximumValue === undefined || currentValue > maximumValue) {
      maximumValue = currentValue;
      continue;
    }

    if (Number.isNaN(currentValue)) {
      return currentValue;
    }
  }

  return maximumValue;
}
