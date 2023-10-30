/*
 * format-dashboard-sidebar.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";
import { recursiveApplyFillClasses } from "./format-dashboard-layout.ts";
import { makeEl } from "./format-dashboard-shared.ts";

const kSidebarPanelClass = "sidebar-panel";
const kSidebarClass = "sidebar";
const kSidebarContentClass = "sidebar-content";

export function processSidebars(doc: Document) {
  // use a counter to provision ids
  const sidebarNodes = doc.querySelectorAll(`.${kSidebarPanelClass}`);
  let sidebarCount = 1;
  for (const sidebarNode of sidebarNodes) {
    const sidebarEl = sidebarNode as Element;
    const sidebarId = sidebarEl.id !== ""
      ? sidebarEl.id
      : `bslib-sidebar-${sidebarCount++}`;

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
    const sidebarMainContentsEl = sidebarEl.querySelector(
      `.${kSidebarContentClass}`,
    );
    if (sidebarMainContentsEl !== null) {
      sidebarMainEl.appendChild(sidebarMainContentsEl);
    }

    // convert to an aside (class sidebar)
    const sidebarContentsEl = sidebarEl.querySelector(`.${kSidebarClass}`);

    const sidebarAsideEl = makeEl("aside", {
      id: sidebarId,
      classes: [kSidebarClass, "html-fill-container", "html-fill-item"],
    }, doc);

    // place contents inside
    if (sidebarContentsEl !== null) {
      sidebarContentsEl.classList.add("html-fill-container", "html-fill-item");
      sidebarAsideEl.appendChild(sidebarContentsEl);
    }

    sidebarContainerEl.appendChild(sidebarMainEl);
    recursiveApplyFillClasses(sidebarContainerEl);

    sidebarContainerEl.appendChild(sidebarAsideEl);
    sidebarContainerEl.append(...sidebarToggle(sidebarId, doc));

    sidebarEl.replaceWith(sidebarContainerEl);
    sidebarContainerEl.parentElement?.classList.add(
      "dashboard-sidebar-container",
    );
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
