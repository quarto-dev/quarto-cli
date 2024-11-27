// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Builds all possible orders of all elements in the given array
 * Ignores equality of elements, meaning this will always return the same
 * number of permutations for a given length of input.
 *
 * @template T The type of the elements in the array.
 *
 * @param inputArray The array to build permutations from.
 *
 * @returns An array of all possible permutations of the given array.
 *
 * @example Basic usage
 * ```ts
 * import { permutations } from "@std/collections/permutations";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const numbers = [ 1, 2 ];
 * const windows = permutations(numbers);
 *
 * assertEquals(windows, [
 *   [ 1, 2 ],
 *   [ 2, 1 ],
 * ]);
 * ```
 */
export function permutations<T>(inputArray: Iterable<T>): T[][] {
  const result: T[][] = [];

  const array = [...inputArray];

  const k = array.length;

  if (k === 0) {
    return result;
  }

  // Heap's Algorithm
  const c = new Array<number>(k).fill(0);

  result.push([...array]);

  let i = 1;

  while (i < k) {
    if (c[i]! < i) {
      if (i % 2 === 0) {
        [array[0], array[i]] = [array[i], array[0]] as [T, T];
      } else {
        [array[c[i]!], array[i]] = [array[i], array[c[i]!]] as [T, T];
      }

      result.push([...array]);

      c[i] += 1;
      i = 1;
    } else {
      c[i] = 0;
      i += 1;
    }
  }

  return result;
}
