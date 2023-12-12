/*
 * format-dashboard-toolbar.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { asCssSize } from "../../core/css.ts";
import { Document, Element } from "../../core/deno-dom.ts";
import { recursiveApplyFillClasses } from "./format-dashboard-layout.ts";
import { makeEl, processAndRemoveAttr } from "./format-dashboard-shared.ts";

const kToolbarPanelClass = "toolbar-panel";
const kToolbarClass = "toolbar";
const kToolbarContentClass = "toolbar-content";

const kToolbarAttrHeight = "data-height";

const kToolbarAttrPosition = "data-position";
const kToolbarAttrPositionEnd = "end";
const kToolbarBottomClass = "toolbar-bottom";

const kToolbarTopLevelClass = "toolbar-toplevel";
const kDashboardToolbarClass = "dashboard-toolbar";

export function processToolbars(doc: Document) {
  // use a counter to provision ids
  const toolbarNodes = doc.querySelectorAll(`.${kToolbarPanelClass}`);

  for (const toolbarNode of toolbarNodes) {
    const toolbarInputEl = toolbarNode as Element;

    // Create the sidebar container
    const toolbarContainerEl = makeEl("div", {
      classes: ["html-fill-item", "html-fill-container"],
      attributes: {},
    }, doc);

    // convert to an aside (class sidebar)
    const toolbarEl = toolbarInputEl.querySelector(`.${kToolbarClass}`);

    // See if there is a width
    if (toolbarEl) {
      // Read the position and apply class if needed
      processAndRemoveAttr(
        toolbarEl,
        kToolbarAttrPosition,
        (el: Element, value: string) => {
          if (value === kToolbarAttrPositionEnd) {
            el.classList.add(kToolbarBottomClass);
          }
        },
      );

      processAndRemoveAttr(
        toolbarEl,
        kToolbarAttrHeight,
        (_el: Element, value: string) => {
          const size = asCssSize(value);

          const styleRaw = toolbarInputEl.parentElement?.getAttribute("style");
          const styleVal = styleRaw !== null ? styleRaw : "";
          const newStyle = styleVal + " --bslib-sidebar-height: " + size;
          toolbarInputEl.parentElement?.setAttribute("style", newStyle);
        },
      );

      toolbarEl.classList.add("html-fill-container");
      toolbarContainerEl.appendChild(toolbarEl);
    }

    // Capture the content (the sidebar's next sibling)
    const toolbarMainContentsEl = toolbarInputEl.querySelector(
      `.${kToolbarContentClass}`,
    );
    if (toolbarMainContentsEl !== null) {
      toolbarContainerEl.appendChild(toolbarMainContentsEl);
    }

    recursiveApplyFillClasses(toolbarContainerEl);

    toolbarInputEl.replaceWith(toolbarContainerEl);
    toolbarContainerEl.classList.add(
      "dashboard-toolbar-container",
    );

    // Decorate the body of the document if there is a top level toolbar panel
    const topLevelToolbar = doc.querySelector(
      ".page-layout-custom >  .dashboard-toolbar-container",
    );
    if (topLevelToolbar !== null) {
      topLevelToolbar.classList.add(kToolbarTopLevelClass);
      doc.body.classList.add(kDashboardToolbarClass);
    }
  }
}
