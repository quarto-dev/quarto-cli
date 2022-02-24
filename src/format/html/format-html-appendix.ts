/*
* format-html-appendix.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, isAbsolute, join } from "path/mod.ts";
import {
  kAppendixAttributionBibTex,
  kAppendixAttributionCiteAs,
  kAuthor,
  kCsl,
  kDate,
  kLang,
  kSectionTitleCitation,
  kSectionTitleReuse,
  kTitle,
} from "../../config/constants.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import { renderBibTex, renderHtml } from "../../core/bibliography.ts";
import { CSL, cslDate, cslNames, cslType, suggestId } from "../../core/csl.ts";
import { Document, Element } from "../../core/deno-dom.ts";
import {
  hasMarginCites,
  hasMarginRefs,
  insertFootnotesTitle,
  insertReferencesTitle,
  insertTitle,
  kAppendixStyle,
  kCitationUrl,
  kLicense,
  kPublicationDate,
  kPublicationFirstPage,
  kPublicationISBN,
  kPublicationISSN,
  kPublicationIssue,
  kPublicationLastPage,
  kPublicationTitle,
  kPublicationType,
  kPublicationVolume,
} from "./format-html-shared.ts";

const kAppendixCreativeCommonsLic = [
  "CC BY",
  "CC BY-SA",
  "CC BY-ND",
  "CC BY-NC",
];

const kStylePlain = "plain";
const kStyleDefault = "default";

const kAppendixHeadingClass = "quarto-appendix-heading";
const kAppendixContentsClass = "quarto-appendix-contents";
const kQuartoSecondaryLabelClass = "quarto-appendix-secondary-label";
const kQuartoCiteAsClass = "quarto-appendix-citeas";
const kQuartoCiteBibtexClass = "quarto-appendix-bibtex";
const kAppendixId = "quarto-appendix";

export async function processDocumentAppendix(
  input: string,
  format: Format,
  flags: PandocFlags,
  doc: Document,
) {
  // Don't do anything at all if the appendix-style is false or 'none'
  if (
    format.metadata[kAppendixStyle] === false ||
    format.metadata[kAppendixStyle] === "none"
  ) {
    return;
  }
  const appendixStyle = parseStyle(
    format.metadata[kAppendixStyle] as string,
  );

  const mainEl = doc.querySelector("main.content");
  if (mainEl) {
    const appendixEl = doc.createElement("DIV");
    appendixEl.setAttribute("id", kAppendixId);
    if (appendixStyle !== kStylePlain) {
      appendixEl.classList.add(appendixStyle);
    }

    const headingClasses = ["anchored", kAppendixHeadingClass];
    if (appendixStyle === kStyleDefault) {
      headingClasses.push("column-leftmargin");
    }

    // Gather the sections that should be included
    // in the Appendix
    const appendixSections: Element[] = [];
    const addSection = (fn: (sectionEl: Element) => void, title?: string) => {
      const containerEl = doc.createElement("SECTION");
      containerEl.classList.add(
        kAppendixContentsClass,
      );
      fn(containerEl);

      if (title) {
        insertTitle(
          doc,
          containerEl,
          title,
          2,
          headingClasses,
        );
      }

      appendixSections.push(containerEl);
    };

    // Move the refs into the appendix
    if (!hasMarginCites(format)) {
      const refsEl = doc.getElementById("refs");
      if (refsEl) {
        addSection((sectionEl) => {
          sectionEl.setAttribute("role", "doc-bibliography");
          sectionEl.appendChild(refsEl);
          insertReferencesTitle(
            doc,
            sectionEl,
            format.language,
            2,
            headingClasses,
          );
        });
      }
    }

    // Move the footnotes into the appendix
    if (!hasMarginRefs(format, flags)) {
      const footnoteEls = doc.querySelectorAll('section[role="doc-endnotes"]');
      if (footnoteEls && footnoteEls.length === 1) {
        const footnotesEl = footnoteEls.item(0) as Element;
        insertFootnotesTitle(
          doc,
          footnotesEl,
          format.language,
          2,
          headingClasses,
        );
        appendixSections.push(footnotesEl);
      }
    }

    // Place Re-use, if appropriate
    if (format.metadata[kLicense]) {
      addSection((sectionEl) => {
        const contentsDiv = doc.createElement("DIV");
        contentsDiv.id = "quarto-reuse";
        contentsDiv.classList.add(
          kAppendixContentsClass,
        );

        const creativeCommons = creativeCommonsLicense(
          format.metadata[kLicense] as string,
        );
        if (creativeCommons) {
          const licenseUrl = creativeCommonsUrl(
            creativeCommons,
            format.metadata[kLang] as string | undefined,
          );
          const linkEl = doc.createElement("A");
          linkEl.innerText = licenseUrl;
          linkEl.setAttribute("rel", "license");
          linkEl.setAttribute("href", licenseUrl);
          contentsDiv.appendChild(linkEl);
        } else {
          const licenseEl = doc.createElement("DIV");
          licenseEl.innerText = format.metadata[kLicense] as string;
          contentsDiv.appendChild(licenseEl);
        }
        sectionEl.appendChild(contentsDiv);
      }, format.language[kSectionTitleReuse] || "Usage");
    }

    // Place the citation for this document itself, if appropriate
    if (format.metadata[kCitationUrl]) {
      // Render the citation data for this document
      const cite = await generateCite(input, format);
      if (cite?.bibtex || cite?.html) {
        addSection((sectionEl) => {
          const contentsDiv = doc.createElement("DIV");
          sectionEl.appendChild(contentsDiv);

          if (cite?.bibtex) {
            // Add the bibtext representation to the appendix
            const bibTexLabelEl = doc.createElement("DIV");
            bibTexLabelEl.classList.add(kQuartoSecondaryLabelClass);
            bibTexLabelEl.innerText =
              format.language[kAppendixAttributionBibTex] ||
              "BibTeX citation";
            contentsDiv.appendChild(bibTexLabelEl);

            const bibTexDiv = doc.createElement("DIV");
            bibTexDiv.classList.add(kQuartoCiteBibtexClass);
            bibTexDiv.innerHTML = cite.bibtex;
            contentsDiv.appendChild(bibTexDiv);
          }

          if (cite?.html) {
            // Add the cite as to the appendix
            const citeLabelEl = doc.createElement("DIV");
            citeLabelEl.classList.add(kQuartoSecondaryLabelClass);
            citeLabelEl.innerText =
              format.language[kAppendixAttributionCiteAs] ||
              "For attribution, please cite this work as:";
            contentsDiv.appendChild(citeLabelEl);
            const entry = extractCiteEl(cite.html, doc);
            if (entry) {
              entry.classList.add(kQuartoCiteAsClass);
              contentsDiv.appendChild(entry);
            }
          }
        }, format.language[kSectionTitleCitation] || "Citation");
      }
    }

    // Move any sections that are marked as appendices
    // We do this last so that the other elements will have already been
    // moved from the document and won't inadvertently be captured
    // (for example if the last section is an appendix it could capture
    // the references
    const appendixSectionNodes = doc.querySelectorAll("section.appendix");
    const appendixSectionEls: Element[] = [];
    for (const appendixSectionNode of appendixSectionNodes) {
      const appendSectionEl = appendixSectionNode as Element;

      // Add the whole thing
      if (appendSectionEl) {
        // Extract the header
        const extractHeaderEl = () => {
          const headerEl = appendSectionEl.querySelector(
            "h1, h2, h3, h4, h5, h6",
          );
          // Always hoist any heading up to h2
          if (headerEl) {
            headerEl.remove();
            const h2 = doc.createElement("h2");
            h2.innerHTML = headerEl.innerHTML;
            return h2;
          } else {
            const h2 = doc.createElement("h2");
            return h2;
          }
        };
        const headerEl = extractHeaderEl();
        headerEl.classList.add(kAppendixHeadingClass);
        if (appendixStyle === kStyleDefault) {
          (headerEl as Element).classList.add("column-leftmargin");
        }

        // Move the contents of the section into a div
        const containerDivEl = doc.createElement("DIV");
        containerDivEl.classList.add(
          kAppendixContentsClass,
        );
        while (appendSectionEl.childNodes.length > 0) {
          containerDivEl.appendChild(appendSectionEl.childNodes[0]);
        }

        appendSectionEl.appendChild(headerEl);
        appendSectionEl.appendChild(containerDivEl);
        appendixSectionEls.push(appendSectionEl);
      }
    }
    // Place the user decorated appendixes at the front of the list
    // of appendixes
    if (appendixSectionEls.length > 0) {
      appendixSections.unshift(...appendixSectionEls);
    }

    // Insert the sections
    appendixSections.forEach((el) => {
      appendixEl.appendChild(el);
    });

    // Only add the appendix if it has at least one section
    if (appendixEl.childElementCount > 0) {
      mainEl.appendChild(appendixEl);
    }
  }
}

function parseStyle(style?: string) {
  switch (style) {
    case "plain":
      return "plain";
    default:
      return kStyleDefault;
  }
}

function creativeCommonsLicense(
  license?: string,
): "CC BY" | "CC BY-SA" | "CC BY-ND" | "CC BY-NC" | undefined {
  if (license && kAppendixCreativeCommonsLic.includes(license)) {
    return license as "CC BY" | "CC BY-SA" | "CC BY-ND" | "CC BY-NC";
  } else {
    return undefined;
  }
}

function creativeCommonsUrl(license: string, lang?: string) {
  const licenseType = license.substring(3);
  if (lang && lang !== "en") {
    return `https://creativecommons.org/licenses/${licenseType.toLowerCase()}/4.0/deed.${
      lang.toLowerCase().replace("-", "_")
    }`;
  } else {
    return `https://creativecommons.org/licenses/${licenseType.toLowerCase()}/4.0/`;
  }
}

async function generateCite(input: string, format: Format) {
  const entry = cslForFormat(format);
  if (entry) {
    // Provides an absolute path to the referenced CSL file
    const getCSLPath = () => {
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

    // Render the HTML and BibTeX form of this document
    const cslPath = getCSLPath();
    const html = await renderHtml(entry, cslPath);
    const bibtex = await renderBibTex(entry);
    return {
      html,
      bibtex,
    };
  } else {
    return undefined;
  }
}

// The removes any addition left margin markup that is added
// to the rendered citation (e.g. a number or so on)
function extractCiteEl(html: string, doc: Document) {
  const htmlDiv = doc.createElement("DIV");
  htmlDiv.innerHTML = html;
  const entry = htmlDiv.querySelector(".csl-entry");
  if (entry) {
    const leftMarginEl = entry.querySelector(".csl-left-margin");
    if (leftMarginEl) {
      leftMarginEl.remove();
      const rightEl = entry.querySelector(".csl-right-inline");
      if (rightEl) {
        rightEl.classList.remove("csl-right-inline");
      }
    }
    return entry;
  } else {
    return undefined;
  }
}

function cslForFormat(format: Format) {
  const type = cslType(format.metadata[kPublicationType] as string);
  const authors = cslNames(format.metadata[kAuthor]);
  const date = cslDate(
    format.metadata[kPublicationDate] || format.metadata[kDate],
  );
  const id = suggestId(authors, date);
  const csl: CSL = {
    id,
    type,
    author: authors,
    title: format.metadata[kTitle] as string,
    issued: date,
  };

  if (format.metadata[kPublicationTitle]) {
    csl["container-title"] = format.metadata[kPublicationTitle] as string;
  }
  if (format.metadata[kPublicationVolume]) {
    csl.volume = format.metadata[kPublicationVolume] as string;
  }
  if (format.metadata[kPublicationIssue]) {
    csl.issue = format.metadata[kPublicationIssue] as string;
  }
  if (format.metadata[kPublicationISBN]) {
    csl.ISBN = format.metadata[kPublicationISBN] as string;
  }
  if (format.metadata[kPublicationISSN]) {
    csl.ISSN = format.metadata[kPublicationISSN] as string;
  }
  if (format.metadata[kPublicationFirstPage]) {
    csl.page = formatPage(
      format.metadata[kPublicationFirstPage] as string,
      format.metadata[kPublicationLastPage] as string,
    );
  }
  if (format.metadata[kCitationUrl]) {
    csl.URL = format.metadata[kCitationUrl] as string;
  }
  return csl;
}

function formatPage(first: string, last?: string) {
  if (first && last) {
    return `${first}-${last}`;
  } else {
    return first;
  }
}
