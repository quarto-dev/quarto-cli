// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { DAY, WEEK } from "./constants.ts";

const DAYS_PER_WEEK = 7;

const Day = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
} as const;

/**
 * Returns the ISO week number of the provided date (1-53).
 *
 * @param date Date to get the week number of.
 * @returns The week number of the provided date.
 *
 * @example Basic usage
 * ```ts
 * import { weekOfYear } from "@std/datetime/week-of-year";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(weekOfYear(new Date("2020-12-28T03:24:00")), 53);
 *
 * assertEquals(weekOfYear(new Date("2020-07-10T03:24:00")), 28);
 * ```
 */
export function weekOfYear(date: Date): number {
  const workingDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  const day = workingDate.getUTCDay();

  const nearestThursday = workingDate.getUTCDate() +
    Day.Thu -
    (day === Day.Sun ? DAYS_PER_WEEK : day);

  workingDate.setUTCDate(nearestThursday);

  // Get first day of year
  const yearStart = new Date(Date.UTC(workingDate.getUTCFullYear(), 0, 1));

  // return the calculated full weeks to nearest Thursday
  return Math.ceil((workingDate.getTime() - yearStart.getTime() + DAY) / WEEK);
}
