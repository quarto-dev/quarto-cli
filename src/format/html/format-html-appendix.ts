/*
* format-html-appendix.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Format, PandocFlags } from "../../config/types.ts";
import { Document, Element } from "../../core/deno-dom.ts";
import {
  hasMarginCites,
  hasMarginRefs,
  insertFootnotesTitle,
  insertReferencesTitle,
  kAppendix,
} from "./format-html-shared.ts";

const kAppendixStyle = "style";

interface AppendixDescriptor {
  [kAppendixStyle]: "full" | "two-column" | "one-column" | "plain";
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

    const headingClasses = ["anchored"];
    if (appendixDesc.style === "full") {
      headingClasses.push("column-sidebar");
    }

    // Move any sections that are marked as appendices
    const appendixHeaderEls = doc.querySelectorAll(".appendix");
    for (const headerEl of appendixHeaderEls) {
      const sectionEl = headerEl.parentElement;
      // Add the whole thing
      if (sectionEl && sectionEl?.tagName === "SECTION") {
        // Remove the header
        headerEl.remove();
        if (appendixDesc.style === "full") {
          (headerEl as Element).classList.add("column-sidebar");
        }

        // Move the contents of the section into a div
        const containerDivEl = doc.createElement("DIV");
        while (sectionEl.childNodes.length > 0) {
          containerDivEl.appendChild(sectionEl.childNodes[0]);
        }

        sectionEl?.appendChild(headerEl);
        sectionEl?.appendChild(containerDivEl);
        appendixEl.appendChild(sectionEl);
      }
    }

    // Move the refs into the appendix
    if (!hasMarginCites(format)) {
      const refsEl = doc.getElementById("refs");
      if (refsEl) {
        const containerEl = doc.createElement("SECTION");
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
    return {
      style,
    };
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
