// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { DAY } from "./constants.ts";

/**
 * Returns the number of the day in the year in the local time zone.
 *
 * @param date Date to get the day of the year of.
 * @return Number of the day in the year in the local time zone.
 *
 * @example Basic usage
 * ```ts
 * import { dayOfYear } from "@std/datetime/day-of-year";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(dayOfYear(new Date("2019-03-11T03:24:00")), 70);
 * ```
 */
export function dayOfYear(date: Date): number {
  // Values from 0 to 99 map to the years 1900 to 1999. All other values are the actual year. (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date)
  // Using setFullYear as a workaround

  const yearStart = new Date(date);

  yearStart.setFullYear(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - date.getTimezoneOffset() * 60 * 1000) -
    (yearStart.getTime() - yearStart.getTimezoneOffset() * 60 * 1000);

  return Math.floor(diff / DAY);
}

/**
 * Returns the number of the day in the year in UTC time.
 *
 * @param date Date to get the day of the year of.
 * @return Number of the day in the year in UTC time.
 *
 * @example Usage
 * ```ts
 * import { dayOfYearUtc } from "@std/datetime/day-of-year";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(dayOfYearUtc(new Date("2019-03-11T03:24:00.000Z")), 70);
 * ```
 */
export function dayOfYearUtc(date: Date): number {
  // Values from 0 to 99 map to the years 1900 to 1999. All other values are the actual year. (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date)
  // Using setUTCFullYear as a workaround

  const yearStart = new Date(date);

  yearStart.setUTCFullYear(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - yearStart.getTime();

  return Math.floor(diff / DAY);
}
