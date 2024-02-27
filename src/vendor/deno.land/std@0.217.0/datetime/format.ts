// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { DateTimeFormatter } from "./_common.ts";

/**
 * Takes an input `date` and a `formatString` to format to a `string`.
 *
 * @example
 * ```ts
 * import { format } from "https://deno.land/std@$STD_VERSION/datetime/format.ts";
 *
 * format(new Date(2019, 0, 20), "dd-MM-yyyy"); // output : "20-01-2019"
 * format(new Date(2019, 0, 20), "yyyy-MM-dd"); // output : "2019-01-20"
 * format(new Date(2019, 0, 20), "dd.MM.yyyy"); // output : "20.01.2019"
 * format(new Date(2019, 0, 20, 16, 34), "MM-dd-yyyy HH:mm"); // output : "01-20-2019 16:34"
 * format(new Date(2019, 0, 20, 16, 34), "MM-dd-yyyy hh:mm a"); // output : "01-20-2019 04:34 PM"
 * format(new Date(2019, 0, 20, 16, 34), "HH:mm MM-dd-yyyy"); // output : "16:34 01-20-2019"
 * format(new Date(2019, 0, 20, 16, 34, 23, 123), "MM-dd-yyyy HH:mm:ss.SSS"); // output : "01-20-2019 16:34:23.123"
 * format(new Date(2019, 0, 20), "'today:' yyyy-MM-dd"); // output : "today: 2019-01-20"
 * format(new Date("2019-01-20T16:34:23:123-05:00"), "yyyy-MM-dd HH:mm:ss", { utc: true });
 * // output : "2019-01-20 21:34:23"
 * ```
 *
 * @param date The date to be formatted.
 * @param formatString The date time string format.
 * @param options The options to customize the formatting of the date.
 * @return The formatted date string.
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

/** Options for {@linkcode format}. */
export interface FormatOptions {
  /** Whether returns the formatted date in UTC instead of local time. */
  utc?: boolean;
}
