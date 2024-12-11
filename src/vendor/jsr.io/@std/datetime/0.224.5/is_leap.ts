// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

function isYearNumberALeapYear(yearNumber: number): boolean {
  return (
    (yearNumber % 4 === 0 && yearNumber % 100 !== 0) || yearNumber % 400 === 0
  );
}

/**
 * Returns whether the given year is a leap year. Passing in a
 * {@linkcode Date} object will return the leap year status of the year of that
 * object and take the current timezone into account. Passing in a number will
 * return the leap year status of that number.
 *
 * This is based on
 * {@link https://docs.microsoft.com/en-us/office/troubleshoot/excel/determine-a-leap-year}.
 *
 * @param year The year in number or `Date` format.
 * @returns `true` if the given year is a leap year; `false` otherwise.
 *
 * @example Basic usage
 * ```ts
 * import { isLeap } from "@std/datetime/is-leap";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(isLeap(new Date("1970-01-02")), false);
 *
 * assertEquals(isLeap(1970), false);
 *
 * assertEquals(isLeap(new Date("1972-01-02")), true);
 *
 * assertEquals(isLeap(1972), true);
 * ```
 *
 * @example Accounting for timezones
 * ```ts no-assert
 * import { isLeap } from "@std/datetime/is-leap";
 *
 *  // True if the local timezone is GMT+0; false if the local timezone is GMT-1
 * isLeap(new Date("2000-01-01"));
 *
 * // True regardless of the local timezone
 * isLeap(2000);
 *
 * ```
 */
export function isLeap(year: Date | number): boolean {
  const yearNumber = year instanceof Date ? year.getFullYear() : year;
  return isYearNumberALeapYear(yearNumber);
}

/**
 * Returns whether the given year is a leap year in UTC time. This always
 * returns the same value regardless of the local timezone.

 * This is based on
 * {@link https://docs.microsoft.com/en-us/office/troubleshoot/excel/determine-a-leap-year}.
 *
 * @param year The year in number or `Date` format.
 * @returns `true` if the given year is a leap year; `false` otherwise.
 *
 * @example Basic usage
 * ```ts
 * import { isUtcLeap } from "@std/datetime/is-leap";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(isUtcLeap(new Date("2000-01-01")), true);
 *
 * assertEquals(isUtcLeap(new Date("December 31, 1999 23:59:59 GMT-01:00")), true);
 *
 * assertEquals(isUtcLeap(2000), true);
 *
 * assertEquals(isUtcLeap(1999), false);
 * ```
 */
export function isUtcLeap(year: Date | number): boolean {
  const yearNumber = year instanceof Date ? year.getUTCFullYear() : year;
  return isYearNumberALeapYear(yearNumber);
}
