// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Check whether byte slices are equal to each other using 8-bit comparisons.
 *
 * @param a First array to check equality
 * @param b Second array to check equality
 * @returns `true` if the arrays are equal, `false` otherwise
 *
 * @private
 */
function equalsNaive(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < b.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Check whether byte slices are equal to each other using 32-bit comparisons.
 *
 * @param a First array to check equality.
 * @param b Second array to check equality.
 * @returns `true` if the arrays are equal, `false` otherwise.
 *
 * @private
 */
function equals32Bit(a: Uint8Array, b: Uint8Array): boolean {
  const len = a.length;
  const compactOffset = 3 - ((a.byteOffset + 3) % 4);
  const compactLen = Math.floor((len - compactOffset) / 4);
  const compactA = new Uint32Array(
    a.buffer,
    a.byteOffset + compactOffset,
    compactLen,
  );
  const compactB = new Uint32Array(
    b.buffer,
    b.byteOffset + compactOffset,
    compactLen,
  );
  for (let i = 0; i < compactOffset; i++) {
    if (a[i] !== b[i]) return false;
  }
  for (let i = 0; i < compactA.length; i++) {
    if (compactA[i] !== compactB[i]) return false;
  }
  for (let i = compactOffset + compactLen * 4; i < len; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Byte length threshold for when to use 32-bit comparisons, based on
 * benchmarks.
 *
 * @see {@link https://github.com/denoland/deno_std/pull/4635}
 */
const THRESHOLD_32_BIT = 160;

/**
 * Check whether byte slices are equal to each other.
 *
 * @param a First array to check equality.
 * @param b Second array to check equality.
 * @returns `true` if the arrays are equal, `false` otherwise.
 *
 * @example Basic usage
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
 */
export function equals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.length >= THRESHOLD_32_BIT &&
      (a.byteOffset % 4) === (b.byteOffset % 4)
    ? equals32Bit(a, b)
    : equalsNaive(a, b);
}
