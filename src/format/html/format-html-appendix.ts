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

const kCreativeCommons = "creative-commons";
const kAppendixColumn = "column";
const kAppendixStyle = "style";

interface AppendixDescriptor {
  [kAppendixColumn]: string;
  [kAppendixStyle]: "2column" | "1column" | "plain";
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
    appendixEl.id = "quarto-appendix";
    if (appendixDesc.column !== "body") {
      appendixEl.classList.add(`column-${appendixDesc.column}`);
    }
    if (appendixDesc.style !== "plain") {
      appendixEl.classList.add(appendixDesc.style);
    }
    mainEl.appendChild(appendixEl);

    // Move any sections that are marked as appendices
    const appendixHeaderEls = doc.querySelectorAll(".appendix");
    for (const headerEl of appendixHeaderEls) {
      const parentEl = headerEl.parentElement;
      if (parentEl && parentEl?.tagName === "SECTION") {
        appendixEl.appendChild(parentEl);
      }
    }

    // Move the refs into the appendix
    if (!hasMarginCites(format)) {
      const refsEl = doc.getElementById("refs");
      if (refsEl) {
        const containerEl = doc.createElement("SECTION");
        containerEl.setAttribute("role", "doc-bibliography");
        containerEl.appendChild(refsEl);
        insertReferencesTitle(doc, containerEl, format.language);
        appendixEl.appendChild(containerEl);
      }
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
  }
}

const kDefaultColumn = "body";
const kDefaultStyle = "2column";

function readAppendixDescriptor(
  format: Format,
): AppendixDescriptor | undefined {
  const appendix = format.metadata[kAppendix];
  if (typeof (appendix) === "string") {
    return {
      column: kDefaultColumn,
      style: appendixStyle(appendix),
    };
  } else if (typeof (appendix) === "object") {
    const appendixRecord = appendix as Record<string, unknown>;
    const column = appendixRecord[kAppendixColumn] as string;
    const style = appendixStyle(appendixRecord[kAppendixStyle] as string);
    return {
      column,
      style,
    };
  } else {
    if (appendix === false) {
      return undefined;
    } else {
      return {
        column: kDefaultColumn,
        style: kDefaultStyle,
      };
    }
  }
}

function appendixStyle(style?: string) {
  switch (style) {
    case "plain":
      return "plain";
    case "1column":
      return "1column";
    case "2column":
      return "2column";
    default:
      return kDefaultStyle;
  }
}
