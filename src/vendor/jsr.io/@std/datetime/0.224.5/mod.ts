// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Utilities for dealing with {@linkcode Date} objects.
 *
 * ```ts
 * import { dayOfYear, isLeap, difference } from "@std/datetime";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(dayOfYear(new Date("2019-03-11T03:24:00")), 70);
 * assertEquals(isLeap(1970), false);
 *
 * const date0 = new Date("2018-05-14");
 * const date1 = new Date("2020-05-13");
 * assertEquals(difference(date0, date1).years, 1);
 * ```
 *
 * @module
 */
export * from "./constants.ts";
export * from "./day_of_year.ts";
export * from "./difference.ts";
export * from "./format.ts";
export * from "./is_leap.ts";
export * from "./parse.ts";
export * from "./week_of_year.ts";
