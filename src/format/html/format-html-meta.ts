/*
 * format-html-meta.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kHtmlEmptyPostProcessResult } from "../../command/render/constants.ts";
import {
  PandocInputTraits,
  RenderedFormat,
} from "../../command/render/types.ts";
import { kCanonicalUrl } from "../../config/constants.ts";
import { Format, Metadata } from "../../config/types.ts";
import { bibliographyCslJson } from "../../core/bibliography.ts";
import {
  CSL,
  cslDateToEDTFDate,
  CSLExtras,
  kAbstractUrl,
  kEIssn,
  kPdfUrl,
} from "../../core/csl.ts";
import { Document } from "../../core/deno-dom.ts";
import { encodeAttributeValue } from "../../core/html.ts";
import { kWebsite } from "../../project/types/website/website-constants.ts";
import {
  documentCSL,
  synthesizeCitationUrl,
} from "../../quarto-core/attribution/document.ts";
import { writeLinkTag, writeMetaTag } from "./format-html-shared.ts";

export const kGoogleScholar = "google-scholar";

export function metadataPostProcessor(
  input: string,
  format: Format,
  offset?: string,
) {
  return async (doc: Document, options: {
    inputMetadata: Metadata;
    inputTraits: PandocInputTraits;
    renderedFormats: RenderedFormat[];
  }) => {
    // Generate a canonical tag if requested
    if (format.render[kCanonicalUrl]) {
      writeCanonicalUrl(
        doc,
        format.render[kCanonicalUrl],
        input,
        options.inputMetadata,
        format.pandoc["output-file"],
        offset,
      );
    }

    if (googleScholarEnabled(format)) {
      const { csl, extras } = documentCSL(
        input,
        options.inputMetadata,
        "webpage",
        format.pandoc["output-file"],
        offset,
      );
      const documentMetadata = googleScholarMeta(csl, extras);
      const referenceMetadata = await googleScholarReferences(
        input,
        options.inputMetadata,
      );
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

  // Authors
  if (csl.author) {
    csl.author.forEach((author) => {
      write(
        "citation_author",
        author.literal || `${author.given} ${author.family}`,
      );
    });
  }

  // Editors
  if (csl.editor) {
    csl.editor.forEach((editor) => {
      write(
        "citation_editor",
        editor.literal || `${editor.given} ${editor.family}`,
      );
    });
  }

  if (csl.issued) {
    const edtfIssued = cslDateToEDTFDate(csl.issued);
    if (edtfIssued) {
      write("citation_publication_date", edtfIssued);
      write("citation_cover_date", edtfIssued);
    }
    const parts = csl.issued["date-parts"];
    if (parts && parts.length > 0) {
      write("citation_year", parts[0][0]);
    }
  }

  if (csl["available-date"]) {
    const edtfAvailable = cslDateToEDTFDate(csl["available-date"]);
    if (edtfAvailable) {
      write("citation_online_date", edtfAvailable);
    }
  }

  if (csl.URL) {
    write(
      "citation_fulltext_html_url",
      csl.URL,
    );
  }

  if (extras[kPdfUrl]) {
    write("citation_pdf_url", extras[kPdfUrl]);
  }

  if (extras[kAbstractUrl]) {
    write("citation_abstract_html_url", extras[kAbstractUrl]);
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

  if (extras[kEIssn]) {
    write("citation_eissn", extras[kEIssn]);
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
  } else if (type === "chapter") {
    write("citation_inbook_title", csl["container-title"]);
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

  if (csl["collection-title"]) {
    write("citation_series_title", csl["collection-title"]);
  }

  return scholarMeta;
}

async function googleScholarReferences(input: string, metadata: Metadata) {
  const scholarMeta: MetaTagData[] = [];
  const write = metadataWriter(scholarMeta);

  // Generate the references by reading the bibliography and parsing the html
  const references = await bibliographyCslJson(input, metadata);

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

function writeCanonicalUrl(
  doc: Document,
  url: string | boolean,
  input: string,
  inputMetadata: Metadata,
  outputFile?: string,
  offset?: string,
) {
  if (typeof url === "string") {
    // Use the explicitly provided URL
    writeLinkTag("canonical", url, doc);
  } else if (url) {
    // Compute a canonical url and include that
    const canonicalUrl = synthesizeCitationUrl(
      input,
      inputMetadata,
      outputFile,
      offset,
    );
    if (canonicalUrl) {
      writeLinkTag("canonical", canonicalUrl, doc);
    }
  }
}
