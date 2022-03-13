/*
* date.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { format, parse } from "datetime/mod.ts";

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

export const formattedDate = (
  dateStr: string,
  dateFormat: string,
  locale = "en",
) => {
  const date = parsePandocDate(dateStr);
  if (date) {
    const formatted = formatDate(
      date,
      locale,
      dateFormat,
    );
    return formatted;
  } else {
    return undefined;
  }
};

export const parsePandocDate = (dateRaw: string) => {
  const formats = [
    "MM/dd/yyyy",
    "MM-dd-yyyy",
    "MM/dd/yy",
    "MM-dd-yy",
    "yyyy-MM-dd",
    "dd MM yyyy",
    "MM dd, yyyy",
  ];
  const parseFormat = (dateStr: string) => {
    for (const format of formats) {
      try {
        const date = parse(dateStr, format);
        return date;
      } catch {
        // This date wouldn't parse, try other formats
      }
    }

    // Try ISO date parse
    try {
      return new Date(dateStr);
    } catch {
      return undefined;
    }
  };
  // Trying parsing format strings
  return parseFormat(dateRaw);
};
