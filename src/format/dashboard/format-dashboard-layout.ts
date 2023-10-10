/*
 * format-dashboard-fill.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";

export function processRows(doc: Document) {
  // Adjust the appearance of row  elements
  const rowNodes = doc.querySelectorAll("div.rows");
  if (rowNodes !== null) {
    for (const rowNode of rowNodes) {
      const rowEl = rowNode as Element;
      rowEl.classList.add("bslib-grid");
      rowEl.classList.remove("rows");

      let rowSize = "max-content";
      if (rowEl.classList.contains("fill")) {
        rowEl.classList.remove("fill");
        rowSize = "1fr";
        rowEl.classList.add("html-fill-container");
      }

      const rowCount = rowEl.childElementCount;
      const currentStyle = rowEl.getAttribute("style");
      const template =
        `display: grid; grid-template-rows:repeat(${rowCount}, minmax(0, ${rowSize}));\ngrid-auto-columns:1fr;`;
      rowEl.setAttribute(
        "style",
        currentStyle === null ? template : `${currentStyle}\n${template}`,
      );
    }
  }
}

export function processColumns(doc: Document) {
  // Adjust the appearance of column element
  const colNodes = doc.querySelectorAll("div.columns");
  if (colNodes !== null) {
    for (const colNode of colNodes) {
      const colEl = colNode as Element;
      colEl.classList.add("bslib-grid");
      colEl.classList.remove("columns");

      const colSize = "1fr";
      if (colEl.classList.contains("fill")) {
        colEl.classList.remove("fill");
        colEl.classList.add("html-fill-container");
      } else {
        colEl.classList.add("no-fill");
      }
      const colCount = colEl.childElementCount;
      const currentStyle = colEl.getAttribute("style");
      const template =
        `display: grid; grid-template-columns:repeat(${colCount}, minmax(0, ${colSize}));\ngrid-auto-rows:1fr;`;
      colEl.setAttribute(
        "style",
        currentStyle === null ? template : `${currentStyle}\n${template}`,
      );
    }
  }
}

// Recursively applies fill classes, skipping elements that
// should be skipped
export const recursiveApplyFillClasses = (el: Element) => {
  applyFillItemClasses(el);
  applyFillContainerClasses(el);
  for (const childEl of el.children) {
    recursiveApplyFillClasses(childEl);
  }
};

export const applyFillItemClasses = (el: Element) => {
  const skipFill = kSkipFillClz.some((clz) => {
    return el.classList.contains(clz) || kSkipFillTagz.includes(el.tagName);
  });
  if (!skipFill) {
    el.classList.add("html-fill-item");
  }
};

const applyFillContainerClasses = (el: Element) => {
  const skipContainer = kSkipContainerClz.some((clz) => {
    return el.classList.contains(clz) ||
      kSkipContainerTagz.includes(el.tagName);
  });
  if (!skipContainer) {
    el.classList.add("html-fill-container");
  }
};

const kSkipContainerTagz = ["P", "FIGCAPTION", "SCRIPT"];
const kSkipContainerClz: string[] = [
  "bi",
  "value-box-grid",
  "value-box-area",
  "value-box-title",
  "value-box-value",
];
const kSkipFillClz: string[] = ["bi", "no-fill", "callout"];
const kSkipFillTagz = ["P", "FIGCAPTION", "SCRIPT"];
