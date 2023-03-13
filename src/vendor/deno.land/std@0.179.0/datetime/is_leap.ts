// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
/**
 * Returns whether the given date or year (in number) is a leap year or not.
 * based on: https://docs.microsoft.com/en-us/office/troubleshoot/excel/determine-a-leap-year
 *
 * @example
 * ```ts
 * import { isLeap } from "https://deno.land/std@$STD_VERSION/datetime/is_leap.ts";
 *
 * isLeap(new Date("1970-01-01")); // => returns false
 * isLeap(new Date("1972-01-01")); // => returns true
 * isLeap(new Date("2000-01-01")); // => returns true
 * isLeap(new Date("2100-01-01")); // => returns false
 * isLeap(1972); // => returns true
 * ```
 *
 * @param year year in number or Date format
 */
export function isLeap(year: Date | number): boolean {
  const yearNumber = year instanceof Date ? year.getFullYear() : year;
  return (
    (yearNumber % 4 === 0 && yearNumber % 100 !== 0) || yearNumber % 400 === 0
  );
}
