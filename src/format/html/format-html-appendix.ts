/*
* format-html-appendix.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { PandocInputTraits } from "../../command/render/types.ts";
import {
  kAppendixAttributionBibTex,
  kAppendixAttributionCiteAs,
  kLang,
  kPositionedRefs,
  kSectionTitleCitation,
  kSectionTitleReuse,
} from "../../config/constants.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import { renderBibTex, renderHtml } from "../../core/bibliography.ts";
import { Document, Element } from "../../core/deno-dom.ts";
import {
  documentCSL,
  getCSLPath,
} from "../../quarto-core/attribution/document.ts";
import {
  createCodeBlock,
  createCodeCopyButton,
  hasMarginCites,
  hasMarginRefs,
  insertFootnotesTitle,
  insertReferencesTitle,
  insertTitle,
  kAppendixStyle,
  kCitation,
  kLicense,
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
  inputTraits: PandocInputTraits,
  format: Format,
  flags: PandocFlags,
  doc: Document,
  offset?: string,
) {
  // Don't do anything at all if the appendix-style is false or 'none'
  if (
    format.metadata.book || // It never makes sense to process the appendix when we're in a book
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
    if (!hasMarginCites(format) && !inputTraits[kPositionedRefs]) {
      const refsEl = doc.getElementById("refs");
      if (refsEl) {
        const findRefTitle = (refsEl: Element) => {
          const parentEl = refsEl.parentElement;
          if (
            parentEl && parentEl.tagName === "SECTION" &&
            parentEl.childElementCount === 2 // The section has only the heading + the refs div
          ) {
            const headingEl = parentEl.querySelector("h1, h2, h3, h4, h5, h6");
            if (headingEl) {
              headingEl.remove();
              return headingEl.innerText;
            }
          }
        };
        const existingTitle = findRefTitle(refsEl);
        addSection((sectionEl) => {
          sectionEl.setAttribute("role", "doc-bibliography");
          sectionEl.appendChild(refsEl);

          if (existingTitle) {
            insertTitle(doc, sectionEl, existingTitle, 2, headingClasses);
          } else {
            insertReferencesTitle(
              doc,
              sectionEl,
              format.language,
              2,
              headingClasses,
            );
          }
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
    if (format.metadata[kCitation]) {
      // Render the citation data for this document
      const cite = await generateCite(input, format, offset);
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

            const bibTexDiv = createCodeBlock(doc, cite.bibtex, "bibtex");
            bibTexDiv.classList.add(kQuartoCiteBibtexClass);
            contentsDiv.appendChild(bibTexDiv);

            const copyButton = createCodeCopyButton(doc, format);
            bibTexDiv.appendChild(copyButton);
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

async function generateCite(input: string, format: Format, offset?: string) {
  const { csl } = documentCSL(input, format, "webpage", offset);
  if (csl) {
    // Render the HTML and BibTeX form of this document
    const cslPath = getCSLPath(input, format);
    const html = await renderHtml(csl, cslPath);
    const bibtex = await renderBibTex(csl);
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
