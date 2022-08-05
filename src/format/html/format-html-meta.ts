/*
* format-html-meta.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kHtmlEmptyPostProcessResult } from "../../command/render/constants.ts";
import { Format, Metadata } from "../../config/types.ts";
import { bibliographyCslJson } from "../../core/bibliography.ts";
import {
  CSL,
  cslDateToEDTFDate,
  CSLExtras,
  kAbstractUrl,
  kFullTextUrl,
  kPdfUrl,
  kPublicUrl,
} from "../../core/csl.ts";
import { Document } from "../../core/deno-dom.ts";
import { encodeAttributeValue } from "../../core/html.ts";
import { kWebsite } from "../../project/types/website/website-constants.ts";
import { documentCSL } from "../../quarto-core/attribution/document.ts";
import { writeMetaTag } from "./format-html-shared.ts";

export const kGoogleScholar = "google-scholar";

export function metadataPostProcessor(
  input: string,
  format: Format,
  offset?: string,
) {
  return async (doc: Document) => {
    if (googleScholarEnabled(format)) {
      const { csl, extras } = documentCSL(input, format, "webpage", offset);
      const documentMetadata = googleScholarMeta(csl, extras);
      const referenceMetadata = await googleScholarReferences(input, format);
      [...documentMetadata, ...referenceMetadata].forEach((meta) => {
        writeMetaTag(meta.name, meta.content, doc);
      });
    }
    // no resource refs
    return Promise.resolve(kHtmlEmptyPostProcessResult);
  };
}

function googleScholarEnabled(format: Format) {
  // Enabled by the format / document
  if (format.metadata[kGoogleScholar] === true) {
    return true;
  }
  // Disabled for the site
  const siteMeta = format.metadata[kWebsite] as Metadata;
  if (siteMeta && siteMeta[kGoogleScholar] === true) {
    return true;
  }
  return false;
}

interface MetaTagData {
  name: string;
  content: string;
}

function googleScholarMeta(
  csl: CSL,
  extras: CSLExtras,
): MetaTagData[] {
  // The scholar metadata that we'll generate into
  const scholarMeta: MetaTagData[] = [];
  const write = metadataWriter(scholarMeta);

  // Process title
  if (csl.title) {
    write("citation_title", csl.title);
  }

  if (csl.abstract) {
    write("citation_abstract", csl.abstract);
  }

  if (extras.keywords) {
    write("citation_keywords", extras.keywords);
  }

  if (extras[kPdfUrl]) {
    write("citation_pdf_url", extras[kPdfUrl]);
  }

  if (extras[kPublicUrl]) {
    write("citation_public_url", extras[kPublicUrl]);
  }

  if (extras[kAbstractUrl]) {
    write("citation_abstract_url", extras[kAbstractUrl]);
  }

  if (extras[kFullTextUrl]) {
    write("citation_fulltext_url", extras[kFullTextUrl]);
  }

  // Authors
  if (csl.author) {
    csl.author.forEach((author) => {
      write(
        "citation_author",
        author.literal || `${author.given} ${author.family}`,
      );
    });
  }

  if (csl["available-date"]) {
    write("citation_online_date", cslDateToEDTFDate(csl["available-date"]));
  }

  if (csl.URL) {
    write(
      "citation_fulltext_html_url",
      csl.URL,
    );
  }

  if (csl.issued) {
    write("citation_publication_date", cslDateToEDTFDate(csl.issued));
  }

  if (csl.issue) {
    write("citation_issue", csl.issue);
  }

  if (csl.DOI) {
    write("citation_doi", csl.DOI);
  }

  if (csl.ISBN) {
    write("citation_isbn", csl.ISBN);
  }

  if (csl.ISSN) {
    write("citation_issn", csl.ISSN);
  }

  if (csl.PMID) {
    write("citation_pmid", csl.PMID);
  }

  if (csl.volume) {
    write("citation_volume", csl.volume);
  }

  if (csl.language) {
    write("citation_language", csl.language);
  }

  if (csl["page-first"]) {
    write("citation_firstpage", csl["page-first"]);
  }

  if (csl["page-last"]) {
    write("citation_lastpage", csl["page-last"]);
  }

  const type = csl.type;
  if (type === "paper-conference") {
    if (csl["container-title"]) {
      write("citation_conference_title", csl["container-title"]);
    }

    if (csl.publisher) {
      write("citation_conference", csl.publisher);
    }
  } else if (type === "thesis") {
    if (csl.publisher) {
      write("citation_dissertation_institution", csl.publisher);
    }
  } else if (type === "report") {
    if (csl.publisher) {
      write(
        "citation_technical_report_institution",
        csl.publisher,
      );
    }
    if (csl.number) {
      write(
        "citation_technical_report_number",
        csl.number,
      );
    }
  } else if (type === "book") {
    if (csl["container-title"]) {
      write("citation_book_title", csl["container-title"]);
    }
  } else {
    if (csl["container-title"]) {
      write("citation_journal_title", csl["container-title"]);
    }

    if (csl["container-title-short"]) {
      write("citation_journal_abbrev", csl["container-title-short"]);
    }

    if (csl.publisher) {
      write("citation_publisher", csl.publisher);
    }
  }

  return scholarMeta;
}

async function googleScholarReferences(input: string, format: Format) {
  const scholarMeta: MetaTagData[] = [];
  const write = metadataWriter(scholarMeta);

  // Generate the references by reading the bibliography and parsing the html
  const references = await bibliographyCslJson(input, format);

  if (references) {
    references.forEach((reference) => {
      const refMetas = googleScholarMeta(reference, {});
      const metaStrs = refMetas.map((refMeta) => {
        return `${refMeta.name}=${refMeta.content};`;
      });
      write("citation_reference", metaStrs.join());
    });
  }
  return scholarMeta;
}

function metadataWriter(metadata: MetaTagData[]) {
  const write = (key: string, value: unknown) => {
    metadata.push({
      name: key,
      content: encodeAttributeValue(value as string),
    });
  };
  return write;
}
