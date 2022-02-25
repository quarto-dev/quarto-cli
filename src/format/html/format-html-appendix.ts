/*
* format-html-appendix.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kLang, kSectionTitleReuse } from "../../config/constants.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import { Document, Element } from "../../core/deno-dom.ts";
import {
  hasMarginCites,
  hasMarginRefs,
  insertFootnotesTitle,
  insertReferencesTitle,
  insertTitle,
  kAppendixStyle,
  kLicense,
} from "./format-html-shared.ts";

const kAppendixCreativeCommonsLic = [
  "CC BY",
  "CC BY-SA",
  "CC BY-ND",
  "CC BY-NC",
];

const kStylePlain = "plain";
const kStyleFull = "full";
const kDefaultStyle = "two-column";

const kAppendixHeadingClass = "quarto-appendix-heading";
const kAppendixContentsClass = "quarto-appendix-contents";
const kAppendixId = "quarto-appendix";

export function processDocumentAppendix(
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
    if (appendixStyle === kStyleFull) {
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
        sectionEl.setAttribute("role", "doc-bibliography");
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
        if (appendixStyle === kStyleFull) {
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
    case "one-column":
      return "one-column";
    case "two-column":
      return "two-column";
    case "full":
      return "full";
    default:
      return kDefaultStyle;
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
