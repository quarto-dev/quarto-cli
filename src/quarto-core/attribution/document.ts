/*
* document.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import {
  kAbstract,
  kAuthor,
  kCsl,
  kDoi,
  kLang,
  kOutputFile,
  kTitle,
} from "../../config/constants.ts";
import { Format, Metadata } from "../../config/types.ts";
import { parseAuthor } from "../../core/author.ts";
import {
  CSL,
  cslDate,
  cslNames,
  CSLType,
  cslType,
  suggestId,
} from "../../core/csl.ts";
import { kSiteUrl } from "../../project/types/website/website-config.ts";
import { kWebsite } from "../../project/types/website/website-config.ts";

const kCitation = "citation";
const kUrl = "url";
const kId = "id";
const kCitationKey = "citation-key";

const kType = "type";
const kCategories = "categories";
const kLanguage = "language";
const kAvailableDate = "available-date";
const kDate = "date";

const kPublisher = "publisher";
const kContainerTitle = "container-title";
const kVolume = "volume";
const kIssue = "issue";
const kISSN = "issn";
const kISBN = "isbn";
const kFirstPage = "firstpage";
const kLastPage = "lastpage";
const kPage = "page";
const kNumber = "number";
const kCustom = "custom";

// Provides an absolute path to the referenced CSL file
export const getCSLPath = (input: string, format: Format) => {
  const cslPath = format.metadata[kCsl] as string;
  if (cslPath) {
    if (isAbsolute(cslPath)) {
      return cslPath;
    } else {
      return join(dirname(input), cslPath);
    }
  } else {
    return undefined;
  }
};

// The default type will be used if the type can't be determined from inspecting
// the metadata. This is particularly useful when differentiating between web pages
// and blog posts.
export function documentCSL(
  input: string,
  format: Format,
  defaultType: CSLType,
  offset?: string,
) {
  const citationMetadata = citationMeta(format);

  // The type
  const type = citationMetadata[kType]
    ? cslType(citationMetadata[kType] as string)
    : defaultType;

  // The title
  const title = (citationMetadata[kTitle] || format.metadata[kTitle]) as string;
  const csl: CSL = {
    title,
    type,
  };

  // The citation key
  const key = citationMetadata[kCitationKey] as string | undefined;
  if (key) {
    csl[kCitationKey] = key;
  }

  // Author
  const authors = parseAuthor(
    format.metadata[kAuthor] || citationMetadata[kAuthor],
  );
  csl.author = cslNames(
    authors?.filter((auth) => auth !== undefined).map((auth) => auth?.name),
  );

  // Url
  const url = documentCitationUrl(input, format, offset);
  if (url) {
    csl.URL = url;
  }

  // Categories
  const categories =
    (citationMetadata[kCategories] || format.metadata[kCategories]);
  if (categories) {
    csl.categories = Array.isArray(categories) ? categories : [categories];
  }

  // Language
  const language = (citationMetadata[kLanguage] || format.metadata[kLang]) as
    | string
    | undefined;
  if (language) {
    csl.language = language;
  }

  // Date
  const availableDate = citationMetadata[kAvailableDate] ||
    format.metadata[kDate];
  if (availableDate) {
    csl[kAvailableDate] = cslDate(availableDate);
  }

  // Issued date
  const issued = citationMetadata[kDate] || format.metadata[kDate];
  if (issued) {
    csl.issued = cslDate(issued);
  }

  // The abstract
  const abstract = citationMetadata[kAbstract] || format.metadata[kAbstract];
  if (abstract) {
    csl.abstract = abstract as string;
  }

  // The publisher
  const publisher = citationMetadata[kPublisher];
  if (publisher) {
    csl.publisher = publisher as string;
  }

  // The publication
  const containerTitle = citationMetadata[kContainerTitle];
  if (containerTitle) {
    csl[kContainerTitle] = containerTitle as string;
  }

  // The id for this item
  csl.id = citationMetadata[kId] as string ||
    suggestId(csl.author, csl.issued);

  // The DOI
  const doi = (citationMetadata[kDoi] || format.metadata[kDoi]) as
    | string
    | undefined;
  if (doi) {
    csl.DOI = doi;
  }

  const issue = citationMetadata[kIssue];
  if (issue) {
    csl.issue = issue as string;
  }

  const volume = citationMetadata[kVolume];
  if (volume) {
    csl.volume = volume as string;
  }

  const number = citationMetadata[kNumber];
  if (number) {
    csl.number = number as string;
  }

  const isbn = citationMetadata[kISBN];
  if (isbn) {
    csl.ISBN = isbn as string;
  }

  const issn = citationMetadata[kISSN];
  if (issn) {
    csl.ISSN = issn as string;
  }

  const pageRange = pages(citationMetadata);
  if (pageRange.firstPage) {
    csl["page-first"] = pageRange.firstPage;
  }
  if (pageRange.lastPage) {
    csl["page-last"] = pageRange.lastPage;
  }
  if (pageRange.page) {
    csl.page = pageRange.page;
  }

  const forwardStringValue = (key: string) => {
    if (citationMetadata[key] !== undefined) {
      csl[key] = citationMetadata[key] as string;
    }
  };
  [
    "title-short",
    "annote",
    "archive",
    "archive_collection",
    "archive_location",
    "archive-place",
    "authority",
    "call-number",
    "chapter-number",
    "citation-number",
    "citation-label",
    "collection-number",
    "collection-title",
    "container-title-short",
    "dimensions",
    "division",
    "edition",
    "event-title",
    "event-place",
    "first-reference-note-number",
    "genre",
    "jurisdiction",
    "keyword",
    "locator",
    "medium",
    "note",
    "number",
    "number-of-pages",
    "number-of-volumes",
    "original-publisher",
    "original-publisher-place",
    "original-title",
    "part",
    "part-title",
    "PMCID",
    "PMID",
    "printing",
    "publisher-place",
    "references",
    "reviewed-genre",
    "reviewed-title",
    "scale",
    "section",
    "source",
    "status",
    "supplement",
    "version",
    "volume-title",
    "volume-title-short",
    "year-suffix",
  ].forEach(forwardStringValue);

  const forwardCSLNameValue = (key: string) => {
    if (citationMetadata[key]) {
      const authors = parseAuthor(citationMetadata[key]);
      csl[key] = cslNames(
        authors?.filter((auth) => auth !== undefined).map((auth) => auth?.name),
      );
    }
  };
  [
    "chair",
    "collection-editor",
    "compiler",
    "composer",
    "container-author",
    "contributor",
    "curator",
    "director",
    "editor",
    "editorial-director",
    "executive-producer",
    "guest",
    "host",
    "interviewer",
    "illustrator",
    "narrator",
    "organizer",
    "original-author",
    "performer",
    "producer",
    "recipient",
    "reviewed-author",
    "script-writer",
    "series-creator",
    "translator",
  ].forEach(forwardCSLNameValue);

  const forwardCSLDateValue = (key: string) => {
    if (citationMetadata[key]) {
      csl[key] = cslDate(citationMetadata[key]);
    }
  };
  ["accessed", "event-date", "original-date", "submitted"].forEach(
    forwardCSLDateValue,
  );

  // Forward custom values
  const custom = citationMetadata[kCustom];
  if (custom) {
    // TODO: Could consider supporting note 'cheater codes' which are the old way of doing this
    csl[kCustom] = custom;
  }

  return csl;
}

interface PageRange {
  firstPage?: string;
  lastPage?: string;
  page?: string;
}

function citationMeta(format: Format): Record<string, unknown> {
  if (typeof (format.metadata[kCitation]) === "object") {
    return format.metadata[kCitation] as Record<string, unknown>;
  } else {
    return {} as Record<string, unknown>;
  }
}

function documentCitationUrl(
  input: string,
  format: Format,
  offset?: string,
) {
  const citeMeta = citationMeta(format);
  if (citeMeta[kUrl]) {
    return citeMeta[kUrl] as string;
  } else {
    const siteMeta = format.metadata[kWebsite] as Metadata | undefined;
    const baseUrl = siteMeta?.[kSiteUrl] as string;
    const outputFile = format.pandoc[kOutputFile] as string;

    if (baseUrl && outputFile && offset) {
      const rootDir = Deno.realPathSync(join(dirname(input), offset));
      if (outputFile === "index.html") {
        return `${baseUrl}/${relative(rootDir, dirname(input))}`;
      } else {
        return `${baseUrl}/${
          relative(rootDir, join(dirname(input), outputFile))
        }`;
      }
    } else {
      // The url is unknown
      return undefined;
    }
  }
}

function pages(citationMetadata: Metadata): PageRange {
  let firstPage = citationMetadata[kFirstPage];
  let lastPage = citationMetadata[kLastPage];
  let pages = citationMetadata[kPage] as string;
  if (pages && pages.includes("-")) {
    const pagesSplit = pages.split("-");
    if (!firstPage) {
      firstPage = pagesSplit[0];
    }

    if (!lastPage) {
      lastPage = pagesSplit[1];
    }
  } else if (pages && !firstPage) {
    firstPage = pages;
  } else if (!pages) {
    if (firstPage && lastPage) {
      pages = `${firstPage} - ${lastPage}`;
    } else if (firstPage) {
      pages = `${firstPage}`;
    }
  }
  return {
    firstPage: firstPage as string,
    lastPage: lastPage as string,
    page: pages,
  };
}
