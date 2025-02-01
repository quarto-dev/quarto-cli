// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { DateTimeFormatter } from "./_date_time_formatter.ts";

/** Options for {@linkcode format}. */
export interface FormatOptions {
  /**
   * Whether returns the formatted date in UTC instead of local time.
   *
   * @default {false}
   */
  utc?: boolean;
}

/**
 * Formats a date to a string with the specified format.
 *
 * The following symbols from
 * {@link https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table | unicode LDML}
 * are supported:
 * - `yyyy` - numeric year
 * - `yy` - 2-digit year
 * - `M` - numeric month
 * - `MM` - 2-digit month
 * - `d` - numeric day
 * - `dd` - 2-digit day
 * - `H` - numeric hour (0-23 hours)
 * - `HH` - 2-digit hour (00-23 hours)
 * - `h` - numeric hour (1-12 hours)
 * - `hh` - 2-digit hour (01-12 hours)
 * - `m` - numeric minute
 * - `mm` - 2-digit minute
 * - `s` - numeric second
 * - `ss` - 2-digit second
 * - `S` - 1-digit fractional second
 * - `SS` - 2-digit fractional second
 * - `SSS` - 3-digit fractional second
 * - `a` - dayPeriod, either `AM` or `PM`
 * - `'foo'` - quoted literal
 * - `./-` - unquoted literal
 *
 * @param date The date to be formatted.
 * @param formatString The date time string format.
 * @param options The options to customize the formatting of the date.
 * @return The formatted date string.
 *
 * @example Basic usage
 * ```ts no-eval
 * import { format } from "@std/datetime/format";
 * import { assertEquals } from "@std/assert";
 *
 * const date = new Date(2019, 0, 20, 16, 34, 23, 123);
 *
 * assertEquals(format(date, "dd-MM-yyyy"), "20-01-2019");
 *
 * assertEquals(format(date, "MM-dd-yyyy HH:mm:ss.SSS"), "01-20-2019 16:34:23.123");
 *
 * assertEquals(format(date, "'today:' yyyy-MM-dd"), "today: 2019-01-20");
 * ```
 *
 * @example UTC formatting
 *
 * Enable UTC formatting by setting the `utc` option to `true`.
 *
 * ```ts no-eval
 * import { format } from "@std/datetime/format";
 * import { assertEquals } from "@std/assert";
 *
 * const date = new Date(2019, 0, 20, 16, 34, 23, 123);
 *
 * assertEquals(format(date, "yyyy-MM-dd HH:mm:ss", { utc: true }), "2019-01-20 05:34:23");
 * ```
 */
export function format(
  date: Date,
  formatString: string,
  options: FormatOptions = {},
): string {
  const formatter = new DateTimeFormatter(formatString);
  return formatter.format(
    date,
    options.utc ? { timeZone: "UTC" } : undefined,
  );
}
