// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Helper functions for working with
 * {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array | Uint8Array}
 * byte slices.
 *
 * ## Concatenate byte slices
 *
 * {@linkcode concat} concatenates an array of byte slices into a single slice.
 *
 * ```ts
 * import { concat } from "@std/bytes/concat";
 *
 * const a = new Uint8Array([0, 1, 2]);
 * const b = new Uint8Array([3, 4, 5]);
 * concat([a, b]); // Uint8Array(6) [ 0, 1, 2, 3, 4, 5 ]
 * ```
 *
 * ## Copy byte slices
 *
 * {@linkcode copy} copies bytes from the `src` array to the `dst` array and
 * returns the number of bytes copied.
 *
 * ```ts
 * import { copy } from "@std/bytes/copy";
 *
 * const src = new Uint8Array([9, 8, 7]);
 * const dst = new Uint8Array([0, 1, 2, 3, 4, 5]);
 *
 * copy(src, dst); // 3
 * dst; // Uint8Array(6) [9, 8, 7, 3, 4, 5]
 * ```
 *
 * ## Check if a byte slice ends with another byte slice
 *
 * {@linkcode endsWith} returns `true` if the suffix array appears at the end of
 * the source array, `false` otherwise.
 *
 * ```ts
 * import { endsWith } from "@std/bytes/ends-with";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const suffix = new Uint8Array([1, 2, 3]);
 *
 * endsWith(source, suffix); // true
 * ```
 *
 * ## Check if two byte slices are equal
 *
 * {@linkcode equals} checks whether byte slices are equal to each other.
 *
 * ```ts
 * import { equals } from "@std/bytes/equals";
 *
 * const a = new Uint8Array([1, 2, 3]);
 * const b = new Uint8Array([1, 2, 3]);
 * const c = new Uint8Array([4, 5, 6]);
 *
 * equals(a, b); // true
 * equals(b, c); // false
 * ```
 *
 * ## Check if a byte slice includes another byte slice
 *
 * {@linkcode includesNeedle} determines whether the source array contains the
 * needle array.
 *
 * ```ts
 * import { includesNeedle } from "@std/bytes/includes-needle";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 *
 * includesNeedle(source, needle); // true
 * ```
 *
 * ## Find the index of a byte slice in another byte slice
 *
 * {@linkcode indexOfNeedle} returns the index of the first occurrence of the
 * needle array in the source array, or -1 if it is not present.
 *
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
 * ## Find the last index of a byte slice in another byte slice
 *
 * {@linkcode lastIndexOfNeedle} returns the index of the last occurrence of the
 * needle array in the source array, or -1 if it is not present.
 *
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
 * ## Repeat a byte slice
 *
 * {@linkcode repeat} returns a new byte slice composed of `count` repetitions
 * of the `source` array.
 *
 * ```ts
 * import { repeat } from "@std/bytes/repeat";
 *
 * const source = new Uint8Array([0, 1, 2]);
 *
 * repeat(source, 3); // Uint8Array(9) [0, 1, 2, 0, 1, 2, 0, 1, 2]
 *
 * repeat(source, 0); // Uint8Array(0) []
 *
 * repeat(source, -1); // Throws `RangeError`
 * ```
 *
 * ## Check if a byte slice starts with another byte slice
 *
 * {@linkcode startsWith} returns `true` if the prefix array appears at the start
 * of the source array, `false` otherwise.
 *
 * ```ts
 * import { startsWith } from "@std/bytes/starts-with";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const prefix = new Uint8Array([0, 1, 2]);
 *
 * startsWith(source, prefix); // true
 * ```
 *
 * @module
 */

export * from "./concat.ts";
export * from "./copy.ts";
export * from "./ends_with.ts";
export * from "./equals.ts";
export * from "./includes_needle.ts";
export * from "./index_of_needle.ts";
export * from "./last_index_of_needle.ts";
export * from "./repeat.ts";
export * from "./starts_with.ts";
