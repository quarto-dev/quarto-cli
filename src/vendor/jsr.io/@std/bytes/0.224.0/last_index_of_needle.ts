// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Returns the index of the last occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * The complexity of this function is `O(source.length * needle.length)`.
 *
 * @param source Source array to check.
 * @param needle Needle array to check for.
 * @param start Start index in the source array to begin the search. Defaults to
 * the end of the array.
 * @returns Index of the last occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * @example Basic usage
 * ```ts
 * import { lastIndexOfNeedle } from "@std/bytes/last-index-of-needle";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 * const notNeedle = new Uint8Array([5, 0]);
 *
 * lastIndexOfNeedle(source, needle); // 5
 * lastIndexOfNeedle(source, notNeedle); // -1
 * ```
 *
 * @example Start index
 * ```ts
 * import { lastIndexOfNeedle } from "@std/bytes/last-index-of-needle";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 *
 * lastIndexOfNeedle(source, needle, 2); // 1
 * lastIndexOfNeedle(source, needle, 6); // 3
 * ```
 * Defining a start index will begin the search at the specified index in the
 * source array.
 */
export function lastIndexOfNeedle(
  source: Uint8Array,
  needle: Uint8Array,
  start: number = source.length - 1,
): number {
  if (start < 0) {
    return -1;
  }
  if (start >= source.length) {
    start = source.length - 1;
  }
  const e = needle[needle.length - 1];
  for (let i = start; i >= 0; i--) {
    if (source[i] !== e) continue;
    let matched = 1;
    let j = i;
    while (
      matched < needle.length &&
      source[--j] === needle[needle.length - 1 - (i - j)]
    ) {
      matched++;
    }
    if (matched === needle.length) {
      return i - needle.length + 1;
    }
  }
  return -1;
}
