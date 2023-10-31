/*
 * format-dashboard-fill.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";
import { isValueBox } from "./format-dashboard-valuebox.ts";
import { asCssSize } from "../../core/css.ts";
import {
  kDashboardGridSkip,
  kDontMutateTags,
  kLayoutAttr,
  kLayoutFill,
  kLayoutFlow,
  Layout,
} from "./format-dashboard-shared.ts";

// Container type classes
const kRowsClass = "rows";
const kColumnsClass = "columns";

// Explicit size attributes
const kHeightAttr = "data-height";
const kWidthAttr = "data-width";

// bslib classes
const kBsLibGridClass = "bslib-grid";
const kHtmlFillItemClass = "html-fill-item";
const kHtmlFillContainerClass = "html-fill-container";

const kHiddenClass = "hidden";

interface FillDescriptor {
  tags: [{
    name: string;
    ignoreClasses: string[];
  }];
  classes: string[];
}

const kNeverFillClasses = [
  "value-box-grid",
  "value-box-area",
  "value-box-title",
  "value-box-value",
  "nav-tabs",
  "card-header",
  "card-footer",
  "callout",
];

// Configuration for skipping elements when applying container classes
// (we skip applying container classes to the following):
const kFillContentElements: FillDescriptor = {
  tags: [{
    name: "div",
    ignoreClasses: kNeverFillClasses,
  }],
  classes: [
    "card",
    "card-body",
    "tab-pane",
    "tab-content",
    "tabset",
    "bslib-grid",
    "bslib-grid-item",
    "sidebar-content",
    "main",
    "bslib-sidebar-layout",
    "cell-output-display",
  ],
};

const kFillContainerElements: FillDescriptor = {
  tags: kFillContentElements.tags,
  classes: [
    ...kFillContentElements.classes,
    "bslib-page-fill",
  ],
};

// Process row Elements (computing the grid heights for the
// row and applying bslib style classes)
export function processRows(doc: Document) {
  // Adjust the appearance of row  elements
  const rowNodes = doc.querySelectorAll(`div.${kRowsClass}`);
  if (rowNodes !== null) {
    for (const rowNode of rowNodes) {
      const rowEl = rowNode as Element;
      // Decorate the row element
      rowEl.classList.add(kBsLibGridClass);
      rowEl.classList.remove(kRowsClass);

      // Compute the layouts for ths rows in this rowEl
      const rowLayouts = computeRowLayouts(rowEl);

      // Compute the percent conversion factor
      const fillFr = computeFillFr(rowLayouts);

      // Create the grid-template-rows value based upon the layouts
      const rowGridSizes = rowLayouts.map((layout) => {
        return toGridSize(layout, fillFr);
      });
      const gridTemplRowsVal = `${rowGridSizes.join(" ")}`;

      // Apply the grid styles
      const currentStyle = rowEl.getAttribute("style");
      const template =
        `display: grid; grid-template-rows: ${gridTemplRowsVal}; grid-auto-columns: minmax(0, 1fr);`;
      rowEl.setAttribute(
        "style",
        currentStyle === null ? template : `${currentStyle}\n${template}`,
      );
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

      // Decorate the column
      colEl.classList.add(kBsLibGridClass);
      colEl.classList.remove(kColumnsClass);

      // Compute the column sizes
      const colLayouts = computeColumnLayouts(colEl);

      // Compute the percent conversion factor
      const fillFr = computeFillFr(colLayouts);

      // Create the grid-template-rows value based upon the layouts
      const gridTemplColVal = `${
        colLayouts.map((layout) => {
          return toGridSize(layout, fillFr);
        }).join(" ")
      }`;

      // Apply the grid styles
      const currentStyle = colEl.getAttribute("style");
      const template =
        `display: grid; grid-template-columns: ${gridTemplColVal};\ngrid-auto-rows: minmax(0, 1fr);`;
      colEl.setAttribute(
        "style",
        currentStyle === null ? template : `${currentStyle}\n${template}`,
      );
    }
  }
}

function computeColumnLayouts(colEl: Element) {
  const layouts: Layout[] = [];
  for (const childEl of colEl.children) {
    if (
      childEl.classList.contains(kHiddenClass) ||
      childEl.classList.contains(kDashboardGridSkip)
    ) {
      // Skip this, it is hidden
    } else {
      const explicitWidth = childEl.getAttribute(kWidthAttr);
      if (explicitWidth !== null) {
        childEl.removeAttribute(kWidthAttr);
        layouts.push(explicitWidth);
      } else {
        layouts.push(kLayoutFill);
      }
    }
  }
  return layouts;
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
    if (
      childEl.classList.contains(kHiddenClass) ||
      childEl.classList.contains(kDashboardGridSkip)
    ) {
      // Skip this, it is hidden
    } else if (explicitHeight !== null) {
      childEl.removeAttribute(kHeightAttr);
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
          const layout = rowLayoutForColumn(childEl, parentLayout);
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

function toGridSize(layout: Layout, fillFr: number) {
  if (layout === kLayoutFill) {
    // Use the fillFr units (which have been calculated)
    return `minmax(${kMinSizeRow}, ${fillFr}fr)`;
  } else if (layout === kLayoutFlow) {
    return `minmax(${kMinSizeRow}, max-content)`;
  } else {
    if (layout.endsWith("px")) {
      // Explicit pixels should specify the exact size
      return layout;
    } else if (layout.match(kEndsWithNumber)) {
      //  Not including units means pixels
      return `${layout}px`;
    } else if (layout.endsWith("%")) {
      // Convert percentages to fr units (just strip the percent and use fr)
      const percentRaw = parseFloat(layout.slice(0, -1));
      const layoutSize = `minmax(${kMinSizeRow}, ${percentRaw}fr)`;
      return layoutSize;
    } else {
      // It has units, pass it through as is
      return `minmax(${kMinSizeRow}, ${asCssSize(layout)})`;
    }
  }
}
const kEndsWithNumber = /[0-9]$/;
const kMinSizeRow = "3em";

function computeFillFr(layouts: Layout[]) {
  const percents: number[] = [];
  let unallocatedFills = 0;
  for (const layout of layouts) {
    if (layout === kLayoutFill) {
      unallocatedFills++;
    } else if (layout.endsWith("%")) {
      const unitless = layout.slice(0, -1);
      percents.push(parseFloat(unitless));
    }
  }

  const allocatedPercent = percents.reduce((prev, current) => {
    return prev + current;
  }, 0);

  // By default, we'll just use a 1 fr baseline
  // If the user has provided some percentage based
  // measures, we'll use those to compute a new baseline
  // fr (which is scaled to use the remain unallocated percentage)
  let fillFr = 1;
  if (allocatedPercent > 0) {
    if (allocatedPercent < 100) {
      fillFr = (100 - allocatedPercent) / unallocatedFills;
    } else {
      fillFr = percents[percents.length - 1];
    }
  }
  return fillFr;
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
  const explicitLayout = el.getAttribute(kLayoutAttr);
  if (explicitLayout !== null) {
    return explicitLayout;
  } else {
    if (isValueBox(el)) {
      return kLayoutFlow;
    } else {
      return kLayoutFill;
    }
  }
}

// Suggest a layout for a column (using a default value)
function rowLayoutForColumn(colEl: Element, defaultLayout: Layout | null) {
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

const shouldApplyClasses = (el: Element, fillDescriptor: FillDescriptor) => {
  if (kDontMutateTags.includes(el.tagName.toUpperCase())) {
    return false;
  }

  // Classes to ignore no matter what
  if (
    kNeverFillClasses.some((neverFillClass) => {
      return el.classList.contains(neverFillClass);
    })
  ) {
    return false;
  }

  // TODO: This is sort of hacked in right here, but could
  // likely be place somewhere else better.
  if (el.tagName === "DIV" && el.children.length > 0) {
    // If this has only flow children then leave the class off
    let hasFillChild = false;
    for (const childNode of el.childNodes) {
      const childEl = childNode as Element;
      if (!childEl.classList?.contains(kLayoutFlow)) {
        hasFillChild = true;
        break;
      }
    }
    return hasFillChild;
  }

  const fillForClass = fillDescriptor.classes.some((clz) => {
    if (el.classList.contains(clz)) {
      return true;
    }
  });
  if (fillForClass) {
    return true;
  }

  const fillForTagDesc = fillDescriptor.tags.some((tagDesc) => {
    return tagDesc.name.toLowerCase() === el.tagName.toLowerCase() &&
      !tagDesc.ignoreClasses.some((clz) => {
        return el.classList.contains(clz);
      });
  });
  if (fillForTagDesc) {
    return true;
  }
  return false;
};

export const applyFillItemClasses = (el: Element) => {
  if (shouldApplyClasses(el, kFillContentElements)) {
    el.classList.add(kHtmlFillItemClass);
  }
};

const applyFillContainerClasses = (el: Element) => {
  if (shouldApplyClasses(el, kFillContainerElements)) {
    el.classList.add(kHtmlFillContainerClass);
  }
};
