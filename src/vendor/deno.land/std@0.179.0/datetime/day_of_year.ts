// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
import { DAY } from "./constants.ts";

/**
 * Returns the number of the day in the year.
 *
 * @example
 * ```ts
 * import { dayOfYear } from "https://deno.land/std@$STD_VERSION/datetime/mod.ts";
 *
 * dayOfYear(new Date("2019-03-11T03:24:00")); // output: 70
 * ```
 *
 * @return Number of the day in year
 */
export function dayOfYear(date: Date): number {
  // Values from 0 to 99 map to the years 1900 to 1999. All other values are the actual year. (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date)
  // Using setFullYear as a workaround

  const yearStart = new Date(date);

  yearStart.setUTCFullYear(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() -
    yearStart.getTime();

  return Math.floor(diff / DAY);
}
