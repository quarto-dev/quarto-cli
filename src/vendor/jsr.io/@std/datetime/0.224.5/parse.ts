// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { DateTimeFormatter } from "./_date_time_formatter.ts";

/**
 * Parses a date string using the specified format string.
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
 * @param dateString The date string to parse.
 * @param formatString The date time string format.
 * @return The parsed date.
 *
 * @example Basic usage
 * ```ts
 * import { parse } from "@std/datetime/parse";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(parse("01-03-2019 16:30", "MM-dd-yyyy HH:mm"), new Date(2019, 0, 3, 16, 30));
 *
 * assertEquals(parse("01-03-2019 16:33:23.123", "MM-dd-yyyy HH:mm:ss.SSS"), new Date(2019, 0, 3, 16, 33, 23, 123));
 * ```
 */
export function parse(dateString: string, formatString: string): Date {
  const formatter = new DateTimeFormatter(formatString);
  const parts = formatter.parseToParts(dateString);
  const sortParts = formatter.sortDateTimeFormatPart(parts);
  return formatter.partsToDate(sortParts);
}
