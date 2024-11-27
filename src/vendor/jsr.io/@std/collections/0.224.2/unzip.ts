// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Builds two separate arrays from the given array of 2-tuples, with the first
 * returned array holding all first tuple elements and the second one holding
 * all the second elements.
 *
 * @template T The type of the first tuple elements.
 * @template U The type of the second tuple elements.
 *
 * @param pairs The array of 2-tuples to unzip.
 *
 * @returns A tuple containing two arrays, the first one holding all first tuple
 * elements and the second one holding all second elements.
 *
 * @example Basic usage
 * ```ts
 * import { unzip } from "@std/collections/unzip";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const parents = [
 *   ["Maria", "Jeff"],
 *   ["Anna", "Kim"],
 *   ["John", "Leroy"],
 * ] as [string, string][];
 *
 * const [moms, dads] = unzip(parents);
 *
 * assertEquals(moms, ["Maria", "Anna", "John"]);
 * assertEquals(dads, ["Jeff", "Kim", "Leroy"]);
 * ```
 */
export function unzip<T, U>(pairs: readonly [T, U][]): [T[], U[]] {
  const { length } = pairs;
  const result: [T[], U[]] = [
    Array<T>(length),
    Array<U>(length),
  ];

  pairs.forEach(([first, second], index) => {
    result[0][index] = first;
    result[1][index] = second;
  });

  return result;
}
