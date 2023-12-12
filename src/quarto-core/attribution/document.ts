/*
 * document.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import {
  kAbstract,
  kAuthor,
  kAuthors,
  kCsl,
  kLang,
  kTitle,
} from "../../config/constants.ts";
import { Format, Metadata } from "../../config/types.ts";
import { parseAuthor } from "../../core/author.ts";
import { normalizePath, pathWithForwardSlashes } from "../../core/path.ts";
import {
  CSL,
  cslDate,
  CSLExtras,
  cslNames,
  CSLType,
  cslType,
  kAbstractUrl,
  kEIssn,
  kPdfUrl,
  suggestId,
} from "../../core/csl.ts";
import {
  kSiteUrl,
  kWebsite,
} from "../../project/types/website/website-constants.ts";
import { basename } from "path/mod.ts";
import { resolveAndFormatDate } from "../../core/date.ts";

const kDOI = "DOI";
const kCitation = "citation";
const kURL = "URL";
const kId = "id";
const kCitationKey = "citation-key";
const kEditor = "editor";

const kType = "type";
const kCategories = "categories";
const kLanguage = "language";
const kAvailableDate = "available-date";
const kIssued = "issued";
const kDate = "date";

const kPublisher = "publisher";
const kContainerTitle = "container-title";
const kVolume = "volume";
const kIssue = "issue";
const kISSN = "issn";
const kISBN = "isbn";
const kPMCID = "pmcid";
const kPMID = "pmid";
const kFirstPage = "page-first";
const kLastPage = "page-last";
const kPage = "page";
const kNumber = "number";
const kCustom = "custom";
const kArchiveCollection = "archive_collection";
const kArchiveLocation = "archive_location";

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
  inputMetadata: Metadata,
  defaultType: CSLType,
  outputFile?: string,
  offset?: string,
): { csl: CSL; extras: CSLExtras } {
  const citationMetadata = citationMeta(inputMetadata);

  // The type
  const type = citationMetadata[kType]
    ? cslType(citationMetadata[kType] as string)
    : defaultType;

  // The title
  const title = (citationMetadata[kTitle] || inputMetadata[kTitle]) as string;
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
    citationMetadata[kAuthor] || inputMetadata[kAuthor] ||
      inputMetadata[kAuthors],
  );
  csl.author = cslNames(
    authors?.filter((auth) => auth !== undefined).map((auth) => auth?.name),
  );

  // Editors
  const editors = parseAuthor(citationMetadata[kEditor]);
  csl.editor = cslNames(
    editors?.filter((editor) => editor !== undefined).map((editor) =>
      editor?.name
    ),
  );
  if (csl.editor && csl.editor.length === 0) {
    delete csl.editor;
  }

  // Categories
  const categories = citationMetadata[kCategories] ||
    inputMetadata[kCategories];
  if (categories) {
    csl.categories = Array.isArray(categories) ? categories : [categories];
  }

  // Language
  const language = (citationMetadata[kLanguage] || inputMetadata[kLang]) as
    | string
    | undefined;
  if (language) {
    csl.language = language;
  }

  // Date
  const availableDate = citationMetadata[kAvailableDate] ||
    resolveAndFormatDate(input, inputMetadata[kDate]);
  if (availableDate) {
    csl[kAvailableDate] = cslDate(availableDate);
  }

  // Issued date
  const issued = citationMetadata[kIssued] ||
    resolveAndFormatDate(input, inputMetadata[kDate]);
  if (issued) {
    csl.issued = cslDate(issued);
  }

  // The abstract
  const abstract = citationMetadata[kAbstract] || inputMetadata[kAbstract];
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

  // This is a helper function that will search
  // metadata for the original key, or a transformed
  // version of it (for example, all upper, then all lower)
  const findValue = (
    baseKey: string,
    metadata: Metadata[],
    transform: (key: string) => string,
  ) => {
    const keys = [baseKey, transform(baseKey)];
    for (const key of keys) {
      for (const md of metadata) {
        const value = md[key] as
          | string
          | undefined;
        if (value) {
          return value;
        }
      }
    }
  };
  const lowercase = (key: string) => {
    return key.toLocaleLowerCase();
  };
  const kebabcase = (key: string) => {
    return key.replaceAll("_", "_");
  };

  // Url
  const url = findValue(kURL, [citationMetadata], lowercase);
  if (url) {
    csl.URL = url;
  } else {
    csl.URL = synthesizeCitationUrl(input, inputMetadata, outputFile, offset);
  }

  // The DOI
  const doi = findValue(kDOI, [citationMetadata, inputMetadata], lowercase);
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

  const isbn = findValue(kISBN, [citationMetadata], lowercase);
  if (isbn) {
    csl.ISBN = isbn as string;
  }

  const issn = findValue(kISSN, [citationMetadata], lowercase);
  if (issn) {
    csl.ISSN = issn as string;
  }

  const pmcid = findValue(kPMCID, [citationMetadata], lowercase);
  if (pmcid) {
    csl.PMCID = pmcid as string;
  }

  const pmid = findValue(kPMID, [citationMetadata], lowercase);
  if (pmid) {
    csl.PMID = pmid as string;
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

  const archiveCollection = findValue(
    kArchiveCollection,
    [citationMetadata],
    kebabcase,
  );
  if (archiveCollection) {
    csl[kArchiveCollection] = archiveCollection;
  }

  const archiveLocation = findValue(
    kArchiveLocation,
    [citationMetadata],
    kebabcase,
  );
  if (archiveLocation) {
    csl[kArchiveLocation] = archiveLocation;
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

  // Process anything extra
  const extras: CSLExtras = {};

  // Process keywords
  const kwString = citationMetadata.keyword;
  if (kwString && typeof kwString === "string") {
    extras.keywords = kwString.split(",");
  } else if (inputMetadata.keywords) {
    const kw = inputMetadata.keywords;
    extras.keywords = Array.isArray(kw) ? kw : [kw];
  }

  // Process extra URLS
  if (citationMetadata[kPdfUrl]) {
    extras[kPdfUrl] = citationMetadata[kPdfUrl] as string;
  }
  if (citationMetadata[kAbstractUrl]) {
    extras[kAbstractUrl] = citationMetadata[kAbstractUrl] as string;
  }

  if (citationMetadata[kEIssn]) {
    extras[kEIssn] = citationMetadata[kEIssn] as string;
  }

  return {
    csl,
    extras,
  };
}

interface PageRange {
  firstPage?: string;
  lastPage?: string;
  page?: string;
}

export function citationMeta(metadata: Metadata): Metadata {
  if (typeof (metadata[kCitation]) === "object") {
    return metadata[kCitation] as Record<string, unknown>;
  } else {
    return {} as Record<string, unknown>;
  }
}

export function synthesizeCitationUrl(
  input: string,
  metadata: Metadata,
  outputFile?: string,
  offset?: string,
) {
  const siteMeta = metadata[kWebsite] as Metadata | undefined;
  const baseUrl = siteMeta?.[kSiteUrl] as string;

  if (baseUrl && outputFile && offset) {
    const rootDir = normalizePath(join(dirname(input), offset));
    if (outputFile === "index.html") {
      return `${baseUrl}/${
        pathWithForwardSlashes(relative(rootDir, dirname(input)))
      }`;
    } else {
      const relativePath = relative(
        rootDir,
        join(dirname(input), basename(outputFile)),
      );
      const part = pathWithForwardSlashes(relativePath);
      return `${baseUrl}/${part}`;
    }
  } else {
    // The url is unknown
    return undefined;
  }
}

function pages(citationMetadata: Metadata): PageRange {
  let firstPage = citationMetadata[kFirstPage];
  let lastPage = citationMetadata[kLastPage];
  let pages = citationMetadata[kPage]
    ? `${citationMetadata[kPage] as string}` // Force pages to string in case user writes `page: 7`
    : undefined;
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
