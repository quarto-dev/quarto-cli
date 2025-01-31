// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { mapValues } from "./map_values.ts";

/**
 * Applies the given reducer to each group in the given grouping, returning the
 * results together with the respective group keys.
 *
 * @template T input type of an item in a group in the given grouping.
 * @template A type of the accumulator value, which will match the returned
 * record's values.
 *
 * @param record The grouping to reduce.
 * @param reducer The reducer function to apply to each group.
 * @param initialValue The initial value of the accumulator.
 *
 * @returns A record with the same keys as the input grouping, where each value
 * is the result of applying the reducer to the respective group.
 *
 * @example Basic usage
 * ```ts
 * import { reduceGroups } from "@std/collections/reduce-groups";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const votes = {
 *   Woody: [2, 3, 1, 4],
 *   Buzz: [5, 9],
 * };
 *
 * const totalVotes = reduceGroups(votes, (sum, vote) => sum + vote, 0);
 *
 * assertEquals(totalVotes, {
 *   Woody: 10,
 *   Buzz: 14,
 * });
 * ```
 */
export function reduceGroups<T, A>(
  record: Readonly<Record<string, ReadonlyArray<T>>>,
  reducer: (accumulator: A, current: T) => A,
  initialValue: A,
): Record<string, A> {
  return mapValues(record, (value) => value.reduce(reducer, initialValue));
}
