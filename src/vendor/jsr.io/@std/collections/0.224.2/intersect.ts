// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { filterInPlace } from "./_utils.ts";

/**
 * Returns all distinct elements that appear at least once in each of the given
 * arrays.
 *
 * @template T The type of the elements in the input arrays.
 *
 * @param arrays The arrays to intersect.
 *
 * @returns An array of distinct elements that appear at least once in each of
 * the given arrays.
 *
 * @example Basic usage
 * ```ts
 * import { intersect } from "@std/collections/intersect";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const lisaInterests = ["Cooking", "Music", "Hiking"];
 * const kimInterests = ["Music", "Tennis", "Cooking"];
 * const commonInterests = intersect(lisaInterests, kimInterests);
 *
 * assertEquals(commonInterests, ["Cooking", "Music"]);
 * ```
 */
export function intersect<T>(...arrays: (readonly T[])[]): T[] {
  const [originalHead, ...tail] = arrays;
  const head = [...new Set(originalHead)];
  const tailSets = tail.map((it) => new Set(it));

  for (const set of tailSets) {
    filterInPlace(head, (it) => set.has(it));
    if (head.length === 0) return head;
  }

  return head;
}
