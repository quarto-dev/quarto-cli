// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { DateTimeFormatter } from "./_common.ts";

/**
 * Takes an input `string` and a `formatString` to parse to a `date`.
 *
 * The following symbols from
 * {@link https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table | unicode LDML}
 * are supported:
 *
 * - `yyyy` - numeric year.
 * - `yy` - 2-digit year.
 * - `M` - numeric month.
 * - `MM` - 2-digit month.
 * - `d` - numeric day.
 * - `dd` - 2-digit day.
 *
 * - `H` - numeric hour (0-23 hours).
 * - `HH` - 2-digit hour (00-23 hours).
 * - `h` - numeric hour (1-12 hours).
 * - `hh` - 2-digit hour (01-12 hours).
 * - `m` - numeric minute.
 * - `mm` - 2-digit minute.
 * - `s` - numeric second.
 * - `ss` - 2-digit second.
 * - `S` - 1-digit fractionalSecond.
 * - `SS` - 2-digit fractionalSecond.
 * - `SSS` - 3-digit fractionalSecond.
 *
 * - `a` - dayPeriod, either `AM` or `PM`.
 *
 * - `'foo'` - quoted literal.
 * - `./-` - unquoted literal.
 *
 * @example
 * ```ts
 * import { parse } from "https://deno.land/std@$STD_VERSION/datetime/parse.ts";
 *
 * parse("20-01-2019", "dd-MM-yyyy"); // output : new Date(2019, 0, 20)
 * parse("2019-01-20", "yyyy-MM-dd"); // output : new Date(2019, 0, 20)
 * parse("20.01.2019", "dd.MM.yyyy"); // output : new Date(2019, 0, 20)
 * parse("01-20-2019 16:34", "MM-dd-yyyy HH:mm"); // output : new Date(2019, 0, 20, 16, 34)
 * parse("01-20-2019 04:34 PM", "MM-dd-yyyy hh:mm a"); // output : new Date(2019, 0, 20, 16, 34)
 * parse("16:34 01-20-2019", "HH:mm MM-dd-yyyy"); // output : new Date(2019, 0, 20, 16, 34)
 * parse("01-20-2019 16:34:23.123", "MM-dd-yyyy HH:mm:ss.SSS"); // output : new Date(2019, 0, 20, 16, 34, 23, 123)
 * ```
 *
 * @param dateString Date string
 * @param formatString Format string
 * @return Parsed date
 */
export function parse(dateString: string, formatString: string): Date {
  const formatter = new DateTimeFormatter(formatString);
  const parts = formatter.parseToParts(dateString);
  const sortParts = formatter.sortDateTimeFormatPart(parts);
  return formatter.partsToDate(sortParts);
}
