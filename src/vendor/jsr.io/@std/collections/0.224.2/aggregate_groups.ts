// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { mapEntries } from "./map_entries.ts";

/**
 * Applies the given aggregator to each group in the given grouping, returning the
 * results together with the respective group keys
 *
 * @template T Type of the values in the input record.
 * @template A Type of the accumulator value, which will match the returned
 * record's values.
 *
 * @param record The grouping to aggregate.
 * @param aggregator The function to apply to each group.
 *
 * @returns A record with the same keys as the input record, but with the values
 * being the result of applying the aggregator to each group.
 *
 * @example Basic usage
 * ```ts
 * import { aggregateGroups } from "@std/collections/aggregate-groups";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const foodProperties = {
 *   Curry: ["spicy", "vegan"],
 *   Omelette: ["creamy", "vegetarian"],
 * };
 *
 * const descriptions = aggregateGroups(
 *   foodProperties,
 *   (current, key, first, acc) => {
 *     return first
 *       ? `${key} is ${current}`
 *       : `${acc} and ${current}`;
 *   },
 * );
 *
 * assertEquals(descriptions, {
 *   Curry: "Curry is spicy and vegan",
 *   Omelette: "Omelette is creamy and vegetarian",
 * });
 * ```
 */
export function aggregateGroups<T, A>(
  record: Readonly<Record<string, ReadonlyArray<T>>>,
  aggregator: (current: T, key: string, first: boolean, accumulator?: A) => A,
): Record<string, A> {
  return mapEntries(
    record,
    ([key, values]) => [
      key,
      // Need the type assertions here because the reduce type does not support
      // the type transition we need
      values.reduce(
        (accumulator, current, currentIndex) =>
          aggregator(current, key, currentIndex === 0, accumulator),
        undefined as A | undefined,
      ) as A,
    ],
  );
}
