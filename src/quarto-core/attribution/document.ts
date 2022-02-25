/*
* document.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import {
  kAuthor,
  kCsl,
  kDate,
  kDoi,
  kOutputFile,
  kTitle,
} from "../../config/constants.ts";
import { Format, Metadata } from "../../config/types.ts";
import { parseAuthor } from "../../core/author.ts";
import { CSL, cslDate, cslNames, cslType, suggestId } from "../../core/csl.ts";
import { kSiteUrl } from "../../project/types/website/website-config.ts";
import { kWebsite } from "../../project/types/website/website-config.ts";

const kPublication = "publication";
const kCitationUrl = "citation-url";
const kCitationId = "citation-id";

const kPublicationType = "type";
const kPublicationInstitution = "institution";
const kPublicationTitle = "title";
const kPublicationDate = "date";
const kPublicationVolume = "volume";
const kPublicationIssue = "issue";
const kPublicationISSN = "issn";
const kPublicationISBN = "isbn";
const kPublicationFirstPage = "firstpage";
const kPublicationLastPage = "lastpage";
const kPublicationPages = "lastpage";
const kPublicationNumber = "number";

export function documentCitationUrl(
  input: string,
  format: Format,
  offset?: string,
) {
  if (format.metadata[kCitationUrl]) {
    return format.metadata[kCitationUrl] as string;
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

// TODO How to figure out type
export function documentCsl(
  input: string,
  format: Format,
  offset?: string,
) {
  const publicationMeta = (format.metadata[kPublication] || {}) as Metadata;
  const type = publicationMeta[kPublicationType]
    ? cslType(publicationMeta[kPublicationType] as string)
    : "post-weblog" || "webpage";

  const title = format.metadata[kTitle] as string;
  const csl: CSL = {
    title,
    type,
  };

  // Author
  const authors = parseAuthor(format.metadata[kAuthor]);
  csl.author = cslNames(
    authors?.filter((auth) => auth !== undefined).map((auth) => auth?.name),
  );

  // Url
  const url = documentCitationUrl(input, format, offset);
  if (url) {
    csl.URL = url;
  }

  // Date
  const availableDate = format.metadata[kDate];
  if (availableDate) {
    csl["available-date"] = cslDate(availableDate);
  }

  // Publication Metadata
  const publicationInstitution = publicationMeta[kPublicationInstitution];
  if (publicationInstitution) {
    csl.publisher = publicationInstitution as string;
  }

  const publicationTitle = publicationMeta[kPublicationTitle];
  if (publicationTitle) {
    csl["container-title"] = publicationTitle as string;
  }

  const issued = publicationMeta[kPublicationDate] || format.metadata[kDate];
  if (issued) {
    csl.issued = cslDate(issued);
  }

  // The id for this item
  csl.id = format.metadata[kCitationId] as string ||
    suggestId(csl.author, csl.issued);

  // The DOI
  if (format.metadata[kDoi]) {
    csl.DOI = format.metadata[kDoi] as string;
  }

  const issue = publicationMeta[kPublicationIssue];
  if (issue) {
    csl.issue = issue as string;
  }

  const volume = publicationMeta[kPublicationVolume];
  if (volume) {
    csl.volume = volume as string;
  }

  const number = publicationMeta[kPublicationNumber];
  if (number) {
    csl.number = number as string;
  }

  const isbn = publicationMeta[kPublicationISBN];
  if (isbn) {
    csl.ISBN = isbn as string;
  }

  const issn = publicationMeta[kPublicationISSN];
  if (issn) {
    csl.ISSN = issn as string;
  }

  const pageRange = pages(publicationMeta);
  if (pageRange.firstPage) {
    csl["page-first"] = pageRange.firstPage;
  }
  if (pageRange.lastPage) {
    csl["page-last"] = pageRange.lastPage;
  }
  if (pageRange.pages) {
    csl.page = pageRange.pages;
  }

  return csl;
}

interface PageRange {
  firstPage?: string;
  lastPage?: string;
  pages?: string;
}

function pages(publicationMeta: Metadata): PageRange {
  let firstPage = publicationMeta[kPublicationFirstPage];
  let lastPage = publicationMeta[kPublicationLastPage];
  let pages = publicationMeta[kPublicationPages] as string;
  if (pages && pages.includes("-")) {
    const pagesSplit = pages.split("_");
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
    pages,
  };
}
