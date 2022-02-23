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

  // Volume number of an article's journal
  volume?: string;

  // Pages numbers of an article within its journal
  page?: string;

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
