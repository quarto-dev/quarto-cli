// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns all elements in the given array that produce a distinct value using
 * the given selector, preserving order by first occurrence.
 *
 * @template T The type of the elements in the input array.
 * @template D The type of the values produced by the selector function.
 *
 * @param array The array to filter for distinct elements.
 * @param selector The function to extract the value to compare for
 * distinctness.
 *
 * @returns An array of distinct elements in the input array.
 *
 * @example Basic usage
 * ```ts
 * import { distinctBy } from "@std/collections/distinct-by";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const names = ["Anna", "Kim", "Arnold", "Kate"];
 * const exampleNamesByFirstLetter = distinctBy(names, (name) => name.charAt(0));
 *
 * assertEquals(exampleNamesByFirstLetter, ["Anna", "Kim"]);
 * ```
 */
export function distinctBy<T, D>(
  array: Iterable<T>,
  selector: (el: T) => D,
): T[] {
  const selectedValues = new Set<D>();
  const result: T[] = [];
  for (const element of array) {
    const selected = selector(element);
    if (!selectedValues.has(selected)) {
      selectedValues.add(selected);
      result.push(element);
    }
  }
  return result;
}
