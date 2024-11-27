// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { DAY, HOUR, MINUTE, SECOND, WEEK } from "./constants.ts";

/**
 * Duration units for {@linkcode DifferenceFormat} and
 * {@linkcode DifferenceOptions}.
 */
export type Unit =
  | "milliseconds"
  | "seconds"
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months"
  | "quarters"
  | "years";

/** Return type for {@linkcode difference}. */
export type DifferenceFormat = Partial<Record<Unit, number>>;

/** Options for {@linkcode difference}. */
export type DifferenceOptions = {
  /**
   * Units to calculate difference in. Defaults to all units.
   */
  units?: Unit[];
};

function calculateMonthsDifference(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) {
    months--;
  }
  return months;
}

/**
 * Calculates the difference of the 2 given dates in various units. If the units
 * are omitted, it returns the difference in the all available units.
 *
 * @param from Year to calculate difference from.
 * @param to Year to calculate difference to.
 * @param options Options such as units to calculate difference in.
 * @returns The difference of the 2 given dates in various units.
 *
 * @example Basic usage
 * ```ts
 * import { difference } from "@std/datetime/difference";
 * import { assertEquals } from "@std/assert";
 *
 * const date0 = new Date("2018-05-14");
 * const date1 = new Date("2020-05-13");
 *
 * assertEquals(difference(date0, date1), {
 *   milliseconds: 63072000000,
 *   seconds: 63072000,
 *   minutes: 1051200,
 *   hours: 17520,
 *   days: 730,
 *   weeks: 104,
 *   months: 23,
 *   quarters: 7,
 *   years: 1
 * });
 * ```
 *
 * @example Calculate difference in specific units
 *
 * The `units` option defines which units to calculate the difference in.
 *
 * ```ts
 * import { difference } from "@std/datetime/difference";
 * import { assertEquals } from "@std/assert";
 *
 * const date0 = new Date("2018-05-14");
 * const date1 = new Date("2020-05-13");
 *
 * const result = difference(date0, date1, { units: ["days", "months", "years"] });
 *
 * assertEquals(result, {
 *   days: 730,
 *   months: 23,
 *   years: 1
 * });
 * ```
 */
export function difference(
  from: Date,
  to: Date,
  options?: DifferenceOptions,
): DifferenceFormat {
  [from, to] = from < to ? [from, to] : [to, from];
  const uniqueUnits = options?.units ? [...new Set(options?.units)] : [
    "milliseconds",
    "seconds",
    "minutes",
    "hours",
    "days",
    "weeks",
    "months",
    "quarters",
    "years",
  ];

  const differenceInMs = Math.abs(from.getTime() - to.getTime());

  const differences: DifferenceFormat = {};

  for (const uniqueUnit of uniqueUnits) {
    switch (uniqueUnit) {
      case "milliseconds":
        differences.milliseconds = differenceInMs;
        break;
      case "seconds":
        differences.seconds = Math.floor(differenceInMs / SECOND);
        break;
      case "minutes":
        differences.minutes = Math.floor(differenceInMs / MINUTE);
        break;
      case "hours":
        differences.hours = Math.floor(differenceInMs / HOUR);
        break;
      case "days":
        differences.days = Math.floor(differenceInMs / DAY);
        break;
      case "weeks":
        differences.weeks = Math.floor(differenceInMs / WEEK);
        break;
      case "months":
        differences.months = calculateMonthsDifference(from, to);
        break;
      case "quarters":
        differences.quarters = Math.floor(
          (differences.months !== undefined && differences.months / 3) ||
            calculateMonthsDifference(from, to) / 3,
        );
        break;
      case "years":
        differences.years = Math.floor(
          (differences.months !== undefined && differences.months / 12) ||
            calculateMonthsDifference(from, to) / 12,
        );
        break;
    }
  }

  return differences;
}
