/*
* date.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { format } from "datetime/mod.ts";

export type DateFormat = "full" | "long" | "medium" | "short" | string;
export type TimeFormat = "full" | "long" | "medium" | "short";

// Formats a date for a locale using either the shorthand form ("full")
// or a format string ("d-M-yyyy")
export const formatDate = (
  date: Date,
  locale: string,
  dateStyle: DateFormat,
  timeStyle?: TimeFormat,
) => {
  if (
    dateStyle === "full" || dateStyle === "long" || dateStyle === "medium" ||
    dateStyle === "short"
  ) {
    const options: Intl.DateTimeFormatOptions = {
      dateStyle,
    };
    if (timeStyle) {
      options.timeStyle = timeStyle;
    }
    return date.toLocaleString(locale, options);
  } else {
    return format(date, dateStyle);
  }
};
