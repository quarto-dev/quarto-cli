/*
 * format-dashboard-fill.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";
import { isValueBox } from "./format-dashboard-valuebox.ts";

// Container type classes
const kRowsClass = "rows";
const kColumnsClass = "columns";

// Carries the layout for a given row or column
const kLayoutAttr = "data-layout";
const kLayoutFill = "fill";
const kLayoutFlow = "flow";
type Layout = "fill" | "flow" | "auto";

// Process row Elements (computing the grid heights for the
// row and applying bslib style classes)
export function processRows(doc: Document) {
  // Adjust the appearance of row  elements
  const rowNodes = doc.querySelectorAll(`div.${kRowsClass}`);
  if (rowNodes !== null) {
    for (const rowNode of rowNodes) {
      processRow(rowNode as Element);
    }
  }
}

// Process column elements
export function processColumns(doc: Document) {
  // Adjust the appearance of column element
  const colNodes = doc.querySelectorAll(`div.${kColumnsClass}`);
  if (colNodes !== null) {
    for (const colNode of colNodes) {
      const colEl = colNode as Element;
      colEl.classList.add("bslib-grid");
      colEl.classList.remove(kColumnsClass);

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

function processRow(rowEl: Element) {
  // Decorate the row element
  rowEl.classList.add("bslib-grid");
  rowEl.classList.remove(kRowsClass);

  // Compute the layouts for ths rows in this rowEl
  const layouts = computeLayouts(rowEl);

  // Create the grid-template-rows value based upon the layouts
  const gridTemplRowsVal = `${layouts.map(toGridHeight).join(" ")}`;

  // Apply the grid styles
  const currentStyle = rowEl.getAttribute("style");
  const template =
    `display: grid; grid-template-rows: ${gridTemplRowsVal}; grid-auto-columns:1fr;`;
  rowEl.setAttribute(
    "style",
    currentStyle === null ? template : `${currentStyle}\n${template}`,
  );

  // If any children are fill children, then this layout is a fill layout
  if (layouts.some((layout) => layout === kLayoutFill)) {
    return kLayoutFill;
  } else {
    return kLayoutFlow;
  }
}

function toGridHeight(layout: Layout) {
  if (layout === kLayoutFill) {
    return `minmax(0, 1fr)`;
  } else {
    return `minmax(0, max-content)`;
  }
}

// Coerce the layout to value valid
function asLayout(layout: string): Layout {
  if (layout === kLayoutFill) {
    return kLayoutFill;
  } else {
    return kLayoutFlow;
  }
}

// Suggest a layout for an element
function suggestLayout(el: Element) {
  if (isValueBox(el)) {
    return kLayoutFlow;
  } else {
    return kLayoutFill;
  }
}

function computeLayouts(rowEl: Element) {
  const parentLayoutRaw = rowEl.getAttribute(kLayoutAttr);
  const parentFill = parentLayoutRaw !== null
    ? asLayout(parentLayoutRaw)
    : null;

  // First determine this row's children layouts
  const layouts: Layout[] = [];
  for (const childEl of rowEl.children) {
    const layout = childEl.getAttribute(kLayoutAttr);
    if (layout !== null) {
      // Does the child have an explicitly set layout
      layouts.push(asLayout(layout));
    } else {
      // Consider the child element and determine the layout
      if (childEl.classList.contains(kRowsClass)) {
        // Process a child row and use that to compute the
        // layout
        const layout = processRow(childEl);
        layouts.push(layout);
      } else if (childEl.classList.contains(kColumnsClass)) {
        // Process a column layout and suggest a layout based
        // upon the contents of the layout
        const layout = columnLayout(childEl, parentFill);
        layouts.push(layout);
      } else {
        if (parentFill !== null) {
          // Use the explicit fill for this child
          layouts.push(parentFill);
        } else {
          // Just make a fill
          const layout = kLayoutFill;
          layouts.push(layout);
        }
      }
    }
  }
  return layouts;
}

// Suggest a layout for a column (using a default value)
function columnLayout(colEl: Element, defaultLayout: Layout | null) {
  const layouts: Layout[] = [];
  for (const childEl of colEl.children) {
    layouts.push(suggestLayout(childEl));
  }
  return layouts.some((layout) => layout === kLayoutFill)
    ? defaultLayout ? defaultLayout : kLayoutFill
    : kLayoutFlow;
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

const kSkipContainerTagz = [
  "P",
  "FIGCAPTION",
  "SCRIPT",
  "SPAN",
  "A",
  "PRE",
  "CODE",
  "BUTTON",
];
const kSkipContainerClz: string[] = [
  "bi",
  "value-box-grid",
  "value-box-area",
  "value-box-title",
  "value-box-value",
];
const kSkipFillClz: string[] = ["bi", "no-fill", "callout"];
const kSkipFillTagz = [
  "P",
  "FIGCAPTION",
  "SCRIPT",
  "SPAN",
  "A",
  "PRE",
  "CODE",
  "BUTTON",
];
