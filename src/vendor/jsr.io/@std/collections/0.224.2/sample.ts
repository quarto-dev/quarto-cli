// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { randomInteger } from "./_utils.ts";

/**
 * Returns a random element from the given array.
 *
 * @template T The type of the elements in the array.
 * @template O The type of the accumulator.
 *
 * @param array The array to sample from.
 *
 * @returns A random element from the given array, or `undefined` if the array
 * is empty.
 *
 * @example Basic usage
 * ```ts
 * import { sample } from "@std/collections/sample";
 * import { assertArrayIncludes } from "@std/assert/assert-array-includes";
 *
 * const numbers = [1, 2, 3, 4];
 * const random = sample(numbers);
 *
 * assertArrayIncludes(numbers, [random]);
 * ```
 */
export function sample<T>(array: readonly T[]): T | undefined {
  const length = array.length;
  return length ? array[randomInteger(0, length - 1)] : undefined;
}
