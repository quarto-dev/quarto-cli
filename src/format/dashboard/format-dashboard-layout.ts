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
type Layout = "fill" | "flow" | string;

const kHeightAttr = "data-height";
const kWidthAttr = "data-width";

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
        `display: grid; grid-template-columns:repeat(${colCount}, minmax(0, ${colSize}));\ngrid-auto-rows: minmax(0, 1fr);`;
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
  const rowLayouts = computeRowLayouts(rowEl);

  // Create the grid-template-rows value based upon the layouts
  const gridTemplRowsVal = `${rowLayouts.map(toGridHeight).join(" ")}`;

  // Apply the grid styles
  const currentStyle = rowEl.getAttribute("style");
  const template =
    `display: grid; grid-template-rows: ${gridTemplRowsVal}; grid-auto-columns: minmax(0, 1fr);`;
  rowEl.setAttribute(
    "style",
    currentStyle === null ? template : `${currentStyle}\n${template}`,
  );
}

function toGridHeight(layout: Layout) {
  if (layout === kLayoutFill) {
    return `minmax(0, 1fr)`;
  } else if (layout === kLayoutFlow) {
    return `minmax(0, max-content)`;
  } else {
    return `minmax(0, ${layout})`;
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

// TODO: We could improve this by pre-computing the row layouts
// and sharing them so we aren't re-recursing through the document
// rows to compute heights
function computeRowLayouts(rowEl: Element) {
  // Capture the parent's fill setting. This will be used
  // to cascade to the child, when needed
  const parentLayoutRaw = rowEl.getAttribute(kLayoutAttr);
  const parentLayout = parentLayoutRaw !== null
    ? asLayout(parentLayoutRaw)
    : null;

  // Build a set of layouts for this row by looking at the children of
  // the row
  const layouts: Layout[] = [];
  for (const childEl of rowEl.children) {
    // If the child has an explicitly set height, just use that
    const explicitHeight = childEl.getAttribute(kHeightAttr);
    if (explicitHeight !== null) {
      layouts.push(explicitHeight);
    } else {
      // The child height isn't explicitly set, figure out the layout
      const layout = childEl.getAttribute(kLayoutAttr);
      if (layout !== null) {
        // That child has either an explicitly set `fill` or `flow` layout
        // attribute, so just use that explicit value
        layouts.push(asLayout(layout));
      } else {
        // This is `auto` mode - no explicit size information is
        // being provided, so we need to figure out what size
        // this child would like
        if (childEl.classList.contains(kRowsClass)) {
          // This child is a row, so process that row and use it's computed
          // layout
          // If any children are fill children, then this layout is a fill layout
          const rowLayouts = computeRowLayouts(childEl);
          if (rowLayouts.some((layout) => layout === kLayoutFill)) {
            layouts.push(kLayoutFill);
          } else {
            layouts.push(kLayoutFlow);
          }
        } else if (childEl.classList.contains(kColumnsClass)) {
          // This child is a column, allow it to provide a layout
          // based upon its own contents
          const layout = columnLayout(childEl, parentLayout);
          layouts.push(layout);
        } else {
          // This isn't a row or column, if possible, just use
          // the parent layout. Otherwise, just make it fill
          if (parentLayout !== null) {
            layouts.push(parentLayout);
          } else {
            // Just make a fill
            layouts.push(kLayoutFill);
          }
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
