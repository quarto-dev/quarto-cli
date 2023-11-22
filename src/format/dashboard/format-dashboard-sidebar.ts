/*
 * format-dashboard-sidebar.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { asCssSize } from "../../core/css.ts";
import { Document, Element } from "../../core/deno-dom.ts";
import { recursiveApplyFillClasses } from "./format-dashboard-layout.ts";
import { makeEl, processAndRemoveAttr } from "./format-dashboard-shared.ts";

const kSidebarPanelClass = "sidebar-panel";
const kSidebarClass = "sidebar";
const kSidebarContentClass = "sidebar-content";

const kSidebarAttrPosition = "data-position";
const kSidebarAttrPositionRight = "right";
const kBsLibSidebarRight = "sidebar-right";

export function makeSidebar(
  id: string,
  sidebar: Element,
  contents: Element[],
  doc: Document,
) {
  // Create the sidebar container
  const sidebarContainerEl = makeEl("div", {
    classes: ["bslib-sidebar-layout", "html-fill-item"],
    attributes: {
      "data-bslib-sidebar-open": "desktop",
      "data-bslib-sidebar-init": "true",
    },
  }, doc);

  // Capture the content (the sidebar's next sibling)
  const sidebarMainEl = makeEl("div", {
    classes: ["main", "html-fill-container"],
  }, doc);
  contents.forEach((content) => {
    sidebarMainEl.appendChild(content);
  });

  // See if there is a width
  // Read the position and apply class if needed
  processAndRemoveAttr(
    sidebar,
    kSidebarAttrPosition,
    (_el: Element, value: string) => {
      if (value === kSidebarAttrPositionRight) {
        sidebarContainerEl.classList.add(kBsLibSidebarRight);
      }
    },
  );

  processAndRemoveAttr(
    sidebar,
    "data-width",
    (_el: Element, value: string) => {
      const size = asCssSize(value);

      const styleRaw = sidebarContainerEl.getAttribute("style");
      const styleVal = styleRaw !== null ? styleRaw : "";
      const newStyle = styleVal + " --bslib-sidebar-width: " + size;
      sidebarContainerEl.setAttribute("style", newStyle);
    },
  );

  // Remove the sidebar class
  sidebar?.classList.remove(kSidebarClass);

  const sidebarAsideEl = makeEl("aside", {
    id,
    classes: [kSidebarClass, "html-fill-container", "html-fill-item"],
  }, doc);

  // place contents inside
  if (sidebar !== null) {
    sidebar.classList.add("html-fill-container", "html-fill-item");
    sidebarAsideEl.appendChild(sidebar);
  }

  sidebarContainerEl.appendChild(sidebarMainEl);
  recursiveApplyFillClasses(sidebarContainerEl);

  sidebarContainerEl.appendChild(sidebarAsideEl);
  sidebarContainerEl.append(...sidebarToggle(id, doc));
  return sidebarContainerEl;
}

export function processSidebars(doc: Document) {
  // use a counter to provision ids
  const sidebarNodes = doc.querySelectorAll(`.${kSidebarPanelClass}`);
  let sidebarCount = 1;
  for (const sidebarNode of sidebarNodes) {
    const sidebarEl = sidebarNode as Element;
    const sidebarId = sidebarEl.id !== ""
      ? sidebarEl.id
      : `bslib-sidebar-${sidebarCount++}`;

    const sidebarContentsEl = sidebarEl.querySelector(`.${kSidebarClass}`);
    const sidebarMainContentsEl = sidebarEl.querySelector(
      `.${kSidebarContentClass}`,
    );

    let sidebarContainerEl = undefined;
    if (sidebarContentsEl !== null && sidebarMainContentsEl !== null) {
      sidebarContainerEl = makeSidebar(sidebarId, sidebarContentsEl, [
        sidebarMainContentsEl,
      ], doc);
      sidebarEl.replaceWith(sidebarContainerEl);
      sidebarContainerEl.parentElement?.classList.add(
        "dashboard-sidebar-container",
      );
    }
  }

  // Decorate the body of the document if there is a top level sidebar panel
  const topLevelSidebar = doc.querySelector(
    ".page-layout-custom > .bslib-sidebar-layout, .page-layout-custom .dashboard-page > .bslib-sidebar-layout",
  );
  if (topLevelSidebar !== null) {
    topLevelSidebar.setAttribute("data-bslib-sidebar-border", "false");
    topLevelSidebar.setAttribute("data-bslib-sidebar-border-radius", "false");

    doc.body.classList.add("dashboard-sidebar");
  }
}

function sidebarToggle(id: string, doc: Document) {
  const html = `
<button class="collapse-toggle" type="button" title="Toggle sidebar" aria-expanded="true" aria-controls="${id}">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="bi bi-chevron-left collapse-icon" style="fill:currentColor;" aria-hidden="true" role="img">
      <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"></path>
    </svg>
</button>
<script data-bslib-sidebar-init>
bslib.Sidebar.initCollapsibleAll()
</script>
`;
  const container = doc.createElement("DIV");
  container.innerHTML = html;
  return container.childNodes;
}
