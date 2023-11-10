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
      processAndRemoveAttr(
        toolbarEl,
        "data-height",
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
      topLevelToolbar.classList.add("toolbar-toplevel");
      doc.body.classList.add("dashboard-toolbar");
    }
  }
}
