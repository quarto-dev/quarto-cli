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

export function processDocumentAppendix(
  format: Format,
  flags: PandocFlags,
  doc: Document,
) {
  // Create a class div id="#quarto-appendix"
  // Support styles: 2 column, 1 column
  // H3, contents
  // Footnotes
  // Citations
  const mainEl = doc.querySelector("main.content");
  const appendix = format.metadata[kAppendix];
  const column = typeof (appendix) === "string" ? appendix : "page";
  if (mainEl) {
    const appendixEl = doc.createElement("DIV");
    appendixEl.id = "quarto-appendix";
    if (column !== "body") {
      appendixEl.classList.add(`column-${column}`);
    }

    mainEl.appendChild(appendixEl);

    // Move the refs into the appendix
    const refsEl = doc.getElementById("refs");
    if (refsEl) {
      const containerEl = doc.createElement("SECTION");
      containerEl.setAttribute("role", "doc-bibliography");
      containerEl.appendChild(refsEl);
      insertReferencesTitle(doc, containerEl, format.language);
      appendixEl.appendChild(containerEl);
    }

    // Move the footnotes into the appendix
    if (!hasMarginRefs(format, flags)) {
      const footnoteEls = doc.querySelectorAll('section[role="doc-endnotes"]');
      if (footnoteEls && footnoteEls.length === 1) {
        const footnotesEl = footnoteEls.item(0) as Element;
        insertFootnotesTitle(doc, footnotesEl, format.language);
        appendixEl.appendChild(footnotesEl);
      }
    }

    if (!hasMarginCites(format)) {
      const appendixHeaderEls = doc.querySelectorAll(".appendix");
      for (const headerEl of appendixHeaderEls) {
        const parentEl = headerEl.parentElement;
        if (parentEl && parentEl?.tagName === "SECTION") {
          appendixEl.appendChild(parentEl);
        }
      }
    }
  }
}
