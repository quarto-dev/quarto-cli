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
  kAppendix,
} from "./format-html-shared.ts";

const kAppendixStyle = "style";
const kAppendixCreativeCommons = "creative-commons";
const kAppendixCreativeCommonsLic = [
  "CC BY",
  "CC BY-SA",
  "CC BY-ND",
  "CC BY-NC",
];

/*
Text and figures are licensed under Creative Commons Attribution ',
        '<a rel="license" href="%s">%s 4.0</a>. %sThe figures that have been reused from ',
        'other sources don\'t fall under this license and can be ',
        'recognized by a note in their caption: "Figure from ...".
        */

interface AppendixDescriptor {
  [kAppendixStyle]: "full" | "two-column" | "one-column" | "plain";
  [kAppendixCreativeCommons]?: "CC BY" | "CC BY-SA" | "CC BY-ND" | "CC BY-NC";
}

export function processDocumentAppendix(
  format: Format,
  flags: PandocFlags,
  doc: Document,
) {
  const mainEl = doc.querySelector("main.content");
  const appendixDesc = readAppendixDescriptor(format);

  if (appendixDesc && mainEl) {
    const appendixEl = doc.createElement("DIV");
    appendixEl.setAttribute("id", "quarto-appendix");
    if (appendixDesc.style !== "plain") {
      appendixEl.classList.add(appendixDesc.style);
    }

    const headingClasses = ["anchored", "quarto-appendix-heading"];
    if (appendixDesc.style === "full") {
      headingClasses.push("column-sidebar");
    }

    // Move any sections that are marked as appendices
    const appendixSectionNodes = doc.querySelectorAll("section.appendix");

    for (const appendixSectionNode of appendixSectionNodes) {
      const appendSectionEl = appendixSectionNode as Element;

      // Add the whole thing
      if (appendSectionEl) {
        // Extract the header
        const extractHeaderEl = () => {
          const headerEl = appendSectionEl.querySelector(
            "h1, h2, h3, h4, h5, h6",
          );
          if (headerEl) {
            headerEl.remove();
            return headerEl;
          } else {
            const h2 = doc.createElement("h2");
            return h2;
          }
        };
        const headerEl = extractHeaderEl();
        headerEl.classList.add("quarto-appendix-heading");
        if (appendixDesc.style === "full") {
          (headerEl as Element).classList.add("column-sidebar");
        }

        // Move the contents of the section into a div
        const containerDivEl = doc.createElement("DIV");
        containerDivEl.classList.add(
          "quarto-appendix-contents",
        );
        while (appendSectionEl.childNodes.length > 0) {
          containerDivEl.appendChild(appendSectionEl.childNodes[0]);
        }

        appendSectionEl.appendChild(headerEl);
        appendSectionEl.appendChild(containerDivEl);
        appendixEl.appendChild(appendSectionEl);
      }
    }

    // Move the refs into the appendix
    if (!hasMarginCites(format)) {
      const refsEl = doc.getElementById("refs");
      if (refsEl) {
        const containerEl = doc.createElement("SECTION");
        containerEl.classList.add(
          "quarto-appendix-contents",
        );
        containerEl.setAttribute("role", "doc-bibliography");
        containerEl.appendChild(refsEl);

        insertReferencesTitle(
          doc,
          containerEl,
          format.language,
          2,
          headingClasses,
        );
        appendixEl.appendChild(containerEl);
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
        appendixEl.appendChild(footnotesEl);
      }
    }

    // Place Re-use, if appropriate
    if (appendixDesc[kAppendixCreativeCommons]) {
      const containerEl = doc.createElement("SECTION");
      containerEl.setAttribute("role", "doc-bibliography");

      const contentsDiv = doc.createElement("DIV");
      contentsDiv.id = "quarto-reuse";

      const licenseUrl = creativeCommonsUrl(
        appendixDesc[kAppendixCreativeCommons]!,
        format.metadata[kLang] as string | undefined,
      );
      const linkEl = doc.createElement("A");
      linkEl.innerText = licenseUrl;
      linkEl.setAttribute("href", licenseUrl);
      contentsDiv.appendChild(linkEl);
      containerEl.appendChild(contentsDiv);

      insertTitle(
        doc,
        containerEl,
        format.language[kSectionTitleReuse] || "Usage",
        2,
        headingClasses,
      );

      appendixEl.appendChild(containerEl);
    }

    if (appendixEl.childElementCount > 0) {
      mainEl.appendChild(appendixEl);
    }
  }
}

const kDefaultStyle = "two-column";

function readAppendixDescriptor(
  format: Format,
): AppendixDescriptor | undefined {
  const appendix = format.metadata[kAppendix];
  if (typeof (appendix) === "string") {
    return {
      style: appendixStyle(appendix),
    };
  } else if (typeof (appendix) === "object") {
    const appendixRecord = appendix as Record<string, unknown>;
    const style = appendixStyle(appendixRecord[kAppendixStyle] as string);
    const appendixDesc: AppendixDescriptor = {
      style,
    };
    const creativeCommons = creativeCommonsLicense(
      appendixRecord[kAppendixCreativeCommons] as string,
    );
    if (creativeCommons) {
      appendixDesc[kAppendixCreativeCommons] = creativeCommons;
    }
    return appendixDesc;
  } else {
    if (appendix === false) {
      return undefined;
    } else {
      return {
        style: kDefaultStyle,
      };
    }
  }
}

function appendixStyle(style?: string) {
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
