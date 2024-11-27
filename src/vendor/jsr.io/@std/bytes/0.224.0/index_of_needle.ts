// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns the index of the first occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * A start index can be specified as the third argument that begins the search
 * at that given index. The start index defaults to the start of the array.
 *
 * The complexity of this function is `O(source.length * needle.length)`.
 *
 * @param source Source array to check.
 * @param needle Needle array to check for.
 * @param start Start index in the source array to begin the search. Defaults to
 * 0.
 * @returns Index of the first occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * @example Basic usage
 * ```ts
 * import { indexOfNeedle } from "@std/bytes/index-of-needle";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 * const notNeedle = new Uint8Array([5, 0]);
 *
 * indexOfNeedle(source, needle); // 1
 * indexOfNeedle(source, notNeedle); // -1
 * ```
 *
 * @example Start index
 * ```ts
 * import { indexOfNeedle } from "@std/bytes/index-of-needle";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 *
 * indexOfNeedle(source, needle, 2); // 3
 * indexOfNeedle(source, needle, 6); // -1
 * ```
 * Defining a start index will begin the search at the specified index in the
 * source array.
 */
export function indexOfNeedle(
  source: Uint8Array,
  needle: Uint8Array,
  start = 0,
): number {
  if (start >= source.length) {
    return -1;
  }
  if (start < 0) {
    start = Math.max(0, source.length + start);
  }
  const s = needle[0];
  for (let i = start; i < source.length; i++) {
    if (source[i] !== s) continue;
    let matched = 1;
    let j = i + 1;
    while (matched < needle.length && source[j] === needle[j - i]) {
      matched++;
      j++;
    }
    if (matched === needle.length) {
      return i;
    }
  }
  return -1;
}
