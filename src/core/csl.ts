/*
* csl.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export interface CSL {
  // The id. This is technically required, but some providers (like crossref) don't provide
  // one
  id?: string;

  // Enumeration, one of the type ids from https://api.crossref.org/v1/types
  type:
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

  // Earliest of published-print and published-online
  issued?: CSLDate;

  // Full titles of the containing work (usually a book or journal)
  "container-title"?: string;

  // Short titles of the containing work (usually a book or journal)
  "short-container-title"?: string;

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
  "original-title"?: string;
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
}

export interface CSLName {
  family: string;
  given: string;
  literal?: string;
}

export interface CSLDate {
  "date-parts"?: Array<[number, number?, number?]>;
  raw?: string;
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
  let suggestedId = `${citeIdLeading.toLowerCase()}${datePart}`;
  if (suggestedId.length === 0) {
    suggestedId = "untitled";
  }
  return suggestedId;
}

// Converts a csl date to an EDTF date.
// See https://www.loc.gov/standards/datetime/
// Currently omits time component so this isn't truly level 0
export function cslDateToEDTFDate(date: CSLDate) {
  if (date["date-parts"]) {
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

export function cslDate(dateStr: unknown): CSLDate | undefined {
  if (typeof (dateStr) === "string") {
    const date = new Date(dateStr);
    if (date) {
      return {
        "date-parts": [[
          date.getFullYear(),
          date.getMonth() + 1,
          date.getDate(),
        ]],
        raw: dateStr,
      };
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

function authorToCslName(author: string): CSLName | undefined {
  const parts = author.split(" ");
  if (parts.length > 0) {
    const given = parts.shift() || "";
    const family = parts.length > 0 ? parts.join("") : "";
    return {
      family,
      given,
      literal: author,
    };
  }
}

export function cslType(type: string) {
  if (types.includes(type)) {
    return type as
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
