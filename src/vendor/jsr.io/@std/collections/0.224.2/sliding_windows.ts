// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** Options for {@linkcode slidingWindows}. */
export interface SlidingWindowsOptions {
  /**
   * If step is set, each window will start that many elements after the last
   * window's start.
   *
   * @default {1}
   */
  step?: number;
  /**
   * If partial is set, windows will be generated for the last elements of the
   * collection, resulting in some undefined values if size is greater than 1.
   *
   * @default {false}
   */
  partial?: boolean;
}

/**
 * Generates sliding views of the given array of the given size and returns a
 * new array containing all of them.
 *
 * If step is set, each window will start that many elements after the last
 * window's start. (Default: 1)
 *
 * If partial is set, windows will be generated for the last elements of the
 * collection, resulting in some undefined values if size is greater than 1.
 *
 * @template T The type of the array elements.
 *
 * @param array The array to generate sliding windows from.
 * @param size The size of the sliding windows.
 * @param options The options for generating sliding windows.
 *
 * @returns A new array containing all sliding windows of the given size.
 *
 * @example Usage
 * ```ts
 * import { slidingWindows } from "@std/collections/sliding-windows";
 * import { assertEquals } from "@std/assert/assert-equals";
 * const numbers = [1, 2, 3, 4, 5];
 *
 * const windows = slidingWindows(numbers, 3);
 * assertEquals(windows, [
 *   [1, 2, 3],
 *   [2, 3, 4],
 *   [3, 4, 5],
 * ]);
 *
 * const windowsWithStep = slidingWindows(numbers, 3, { step: 2 });
 * assertEquals(windowsWithStep, [
 *   [1, 2, 3],
 *   [3, 4, 5],
 * ]);
 *
 * const windowsWithPartial = slidingWindows(numbers, 3, { partial: true });
 * assertEquals(windowsWithPartial, [
 *   [1, 2, 3],
 *   [2, 3, 4],
 *   [3, 4, 5],
 *   [4, 5],
 *   [5],
 * ]);
 * ```
 */
export function slidingWindows<T>(
  array: readonly T[],
  size: number,
  options: SlidingWindowsOptions = {},
): T[][] {
  const { step = 1, partial = false } = options;

  if (
    !Number.isInteger(size) || !Number.isInteger(step) || size <= 0 || step <= 0
  ) {
    throw new RangeError("Both size and step must be positive integer.");
  }

  return Array.from(
    { length: Math.floor((array.length - (partial ? 1 : size)) / step + 1) },
    (_, i) => array.slice(i * step, i * step + size),
  );
}
