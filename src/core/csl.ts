/*
 * csl.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { formatDate, parsePandocDate } from "./date.ts";

export const kPdfUrl = "pdf-url";
export const kAbstractUrl = "abstract-url";
export const kEIssn = "eissn";

export interface CSLExtras {
  [kPdfUrl]?: string;
  [kAbstractUrl]?: string;
  [kEIssn]?: string;
  keywords?: string[];
}

export interface CSL extends Record<string, unknown> {
  // The id. This is technically required, but some providers (like crossref) don't provide
  // one
  id?: string;

  "citation-key"?: string;

  // Enumeration, one of the type ids from https://api.crossref.org/v1/types
  type: CSLType;

  // Name of work's publisher
  publisher?: string;

  // Title
  title?: string;

  // DOI of the work
  DOI?: string;

  // URL form of the work's DOI
  URL?: string;

  // Array of Contributors
  author?: CSLName[];

  editor?: CSLName[];

  // Earliest of published-print and published-online
  issued?: CSLDate;

  // Full titles of the containing work (usually a book or journal)
  "container-title"?: string;

  // Short titles of the containing work (usually a book or journal)
  "container-title-short"?: string;

  // Issue number of an article's journal
  issue?: string;

  // The number of this item (for example, report number)
  number?: string;

  // Volume number of an article's journal
  volume?: string;

  // Pages numbers of an article within its journal
  page?: string;

  // First page of the range of pages the item (e.g. a journal article)
  // covers in a container (e.g. a journal issue)
  "page-first"?: string;

  // Last page of the range of pages the item (e.g. a journal article)
  // covers in a container (e.g. a journal issue)
  // WARNING THIS IS NOT STRICTLY CSL
  "page-last"?: string;

  // These properties are often not included in CSL entries and are here
  // primarily because they may need to be sanitized
  ISSN?: string;
  ISBN?: string;
  PMID?: string;
  "original-title"?: string;
  "collection-title"?: string;
  "short-title"?: string;
  subtitle?: string;
  subject?: string;
  archive?: string;
  license?: [];

  // Date the item was initially available (e.g. the online publication date of a
  // journal article before its formal publication date; the date a treaty
  // was made available for signing)
  "available-date"?: CSLDate;

  "abstract"?: string;

  "language"?: string;

  categories?: string[];
}

export interface CSLName {
  // “family” - surname minus any particles and suffixes
  family: string;

  // “given” - given names, either full (“John Edward”) or initialized (“J. E.”)
  given: string;

  // “dropping-particle” - name particles that are dropped when only the surname
  // is shown (“van” in “Ludwig van Beethoven”, which becomes “Beethoven”, or “von”
  // in “Alexander von Humboldt”, which becomes “Humboldt”)
  ["dropping-particle"]?: string;

  // “non-dropping-particle” - name particles that are not dropped when only the
  // surname is shown (“van” in the Dutch surname “van Gogh”) but which may be
  // treated separately from the family name, e.g. for sorting
  ["non-dropping-particle"]?: string;

  // “suffix” - name suffix, e.g. “Jr.” in “John Smith Jr.” and “III” in “Bill Gates III”
  suffix?: string;

  // A 'literal' representation of the name. May be displayed verbatim in contexts
  literal?: string;
}

export interface CSLDate {
  "date-parts"?: Array<[number, number?, number?]>;
  ["iso-8601"]: string;
  // The raw input
  raw?: string;
  // A 'literal' representation of the name. May be displayed verbatim in contexts
  literal?: string;
}

export function suggestId(author: CSLName[], date?: CSLDate) {
  // Try to get the last name
  let citeIdLeading = "";
  if (author && author.length > 0) {
    if (author[0].family) {
      citeIdLeading = author[0].family;
    } else if (author[0].literal) {
      citeIdLeading = author[0].literal;
    }
  }

  // Try to get the publication year
  let datePart = "";
  if (date && date["date-parts"] && date["date-parts"].length > 0) {
    const yearIssued = date["date-parts"][0][0];
    // Sometimes, data arrives with a null value, ignore null
    if (yearIssued) {
      datePart = yearIssued + "";
    }
  }

  // Create a deduplicated string against the existing entries
  let suggestedId = `${
    citeIdLeading.replaceAll(/\s+/g, "_").toLowerCase()
  }${datePart}`;
  if (suggestedId.length === 0) {
    suggestedId = "untitled";
  }
  return suggestedId;
}

// Converts a csl date to an EDTF date.
// See https://www.loc.gov/standards/datetime/
// Currently omits time component so this isn't truly level 0
export function cslDateToEDTFDate(date: CSLDate) {
  if (date["date-parts"] && date["date-parts"].length > 0) {
    const paddedParts = date["date-parts"][0].map((part) => {
      const partStr = part?.toString();
      if (partStr?.length === 1) {
        return `0${partStr}`;
      }
      return partStr;
    });
    return paddedParts.join("-");
  }
}

export function cslNames(authors: unknown) {
  const cslNames: CSLName[] = [];
  const authorList = Array.isArray(authors) ? authors : [authors];
  authorList.forEach((auth) => {
    if (auth) {
      const name = authorToCslName(auth);
      if (name) {
        cslNames.push(name);
      }
    }
  });
  return cslNames;
}

const isCslDate = (dateRaw: unknown) => {
  if (typeof dateRaw === "object") {
    // deno-lint-ignore no-explicit-any
    return ((dateRaw as any)["date-parts"] !== undefined) &&
      // deno-lint-ignore no-explicit-any
      (dateRaw as any)["iso-8601"] !== undefined;
  } else {
    return false;
  }
};

export function cslDate(dateRaw: unknown): CSLDate | undefined {
  const toDateArray = (dateArr: number[]): CSLDate | undefined => {
    if (dateArr.length === 0) {
      return undefined;
    } else if (dateArr.length === 1) {
      return {
        "date-parts": [[
          dateArr[0],
        ]],
        "iso-8601": `${dateArr[0]}`,
      };
    } else if (dateArr.length === 2) {
      return {
        "date-parts": [[
          dateArr[0],
          dateArr[1],
        ]],
        "iso-8601": `${dateArr[0]}-${dateArr[1]}`,
      };
    } else if (dateArr.length >= 3) {
      return {
        "date-parts": [[
          dateArr[0],
          dateArr[1],
          dateArr[2],
        ]],
        "iso-8601": `${dateArr[0]}-${dateArr[1]}-${dateArr[2]}`,
      };
    }
  };

  if (Array.isArray(dateRaw)) {
    const dateArr = dateRaw as number[];
    return toDateArray(dateArr);
  } else if (typeof dateRaw === "number") {
    const parseNumeric = (dateStr: string) => {
      let dateParsed = dateStr;
      const chomps = [4, 2, 2];
      const date: number[] = [];
      for (const chomp of chomps) {
        if (dateParsed.length >= chomp) {
          const part = dateParsed.substring(0, chomp);
          if (!isNaN(+part)) {
            date.push(+part);
            dateParsed = dateParsed.substring(chomp);
          } else {
            break;
          }
        } else {
          break;
        }
      }
      if (date.length > 0) {
        return date;
      } else {
        return undefined;
      }
    };

    const dateStr = String(dateRaw);
    const dateArr = parseNumeric(dateStr);
    if (dateArr) {
      return toDateArray(dateArr);
    }
  } else if (typeof dateRaw === "string") {
    // Look for an explicit month year like 1999-04
    const match = dateRaw.match(/^(\d\d\d\d)[-/](\d\d)$/);
    if (match) {
      return {
        "date-parts": [[
          parseInt(match[1]),
          parseInt(match[2]),
        ]],
        "iso-8601": `${match[1]}-${match[2]}`,
      };
    } else {
      // Trying parsing format strings
      const date = parsePandocDate(dateRaw);
      if (date) {
        const formatted = formatDate(date, "YYYY-MM-DD");
        return {
          "date-parts": [[
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate(),
          ]],
          literal: formatDate(date, "YYYY-MM-DD"),
          raw: dateRaw,
          "iso-8601": formatted,
        };
      }
    }

    return undefined;
  } else if (isCslDate(dateRaw)) {
    return dateRaw as CSLDate;
  } else if (dateRaw !== null && typeof dateRaw === "object") {
    const dateParts: number[] = [];
    if ("year" in dateRaw) {
      dateParts.push((dateRaw as { year: number })["year"]);
      if ("month" in dateRaw) {
        dateParts.push((dateRaw as { month: number })["month"]);
        if ("day" in dateRaw) {
          dateParts.push((dateRaw as { day: number })["day"]);
        }
      }
      return {
        "date-parts": [dateParts as [number, number?, number?]],
        "iso-8601": dateParts.join("-"),
      };
    } else {
      return undefined;
    }
  }
}

function authorToCslName(
  author: unknown,
): CSLName | undefined {
  if (typeof author === "string") {
    const parts = author.split(" ");
    if (parts.length > 0) {
      const given = parts.shift() || "";
      const family = parts.length > 0 ? parts.join(" ") : "";
      return {
        family,
        given,
      };
    }
  } else {
    return author as CSLName;
  }
}

export type CSLType =
  | "article"
  | "article-journal"
  | "article-magazine"
  | "article-newspaper"
  | "bill"
  | "book"
  | "broadcast"
  | "chapter"
  | "classic"
  | "collection"
  | "dataset"
  | "document"
  | "entry"
  | "entry-dictionary"
  | "entry-encyclopedia"
  | "event"
  | "figure"
  | "graphic"
  | "hearing"
  | "interview"
  | "legal_case"
  | "legislation"
  | "manuscript"
  | "map"
  | "motion_picture"
  | "musical_score"
  | "pamphlet"
  | "paper-conference"
  | "patent"
  | "performance"
  | "periodical"
  | "personal_communication"
  | "post"
  | "post-weblog"
  | "regulation"
  | "report"
  | "review"
  | "review-book"
  | "software"
  | "song"
  | "speech"
  | "standard"
  | "thesis"
  | "treaty"
  | "webpage";

export function cslType(type: string) {
  if (types.includes(type)) {
    return type as CSLType;
  } else {
    if (type === "journal") {
      return "article-journal";
    } else if (type === "conference") {
      return "paper-conference";
    } else if (type === "dissertation") {
      return "thesis";
    }
    return "article";
  }
}

const types = [
  "article",
  "article-journal",
  "article-magazine",
  "article-newspaper",
  "bill",
  "book",
  "broadcast",
  "chapter",
  "classic",
  "collection",
  "dataset",
  "document",
  "entry",
  "entry-dictionary",
  "entry-encyclopedia",
  "event",
  "figure",
  "graphic",
  "hearing",
  "interview",
  "legal_case",
  "legislation",
  "manuscript",
  "map",
  "motion_picture",
  "musical_score",
  "pamphlet",
  "paper-conference",
  "patent",
  "performance",
  "periodical",
  "personal_communication",
  "post",
  "post-weblog",
  "regulation",
  "report",
  "review",
  "review-book",
  "software",
  "song",
  "speech",
  "standard",
  "thesis",
  "treaty",
  "webpage",
];
