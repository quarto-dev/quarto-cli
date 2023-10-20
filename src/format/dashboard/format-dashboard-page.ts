/*
 * format-dashboard-page.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";
import { recursiveApplyFillClasses } from "./format-dashboard-layout.ts";
import { kDashboardGridSkip, makeEl } from "./format-dashboard-shared.ts";

const kPageClass = "dashboard-page";
const kAttrTitle = "data-title";

interface NavItem {
  id: string;
  text: string;
  active: boolean;
}

export function processPages(doc: Document) {
  // Find the pages, if any
  const pageNodes = doc.querySelectorAll(`.${kPageClass}`);
  if (pageNodes.length === 0) {
    // No pages to process, audi 5000
    return;
  }

  // Find the navbar, which will be using to make navigation
  const navbarEl = doc.querySelector(".navbar");
  if (!navbarEl) {
    throw new Error(
      "Expected a navbar in the dashboard output since pages are specified.",
    );
  }

  // The target container
  const navbarContainerEl = navbarEl.querySelector(".navbar-container");
  if (!navbarContainerEl) {
    throw new Error(
      "Expected the navbar to have a container marked with `.navbar-container`.",
    );
  }

  // Build up the navigation descriptors, marking up the pages as we go
  const navItems: NavItem[] = [];
  let counter = 1;
  for (const pageNode of pageNodes) {
    const pageEl = pageNode as Element;

    const id = pageEl.id ? pageEl.id : "dashboard-page-" + counter;
    const text = pageEl.getAttribute(kAttrTitle);
    const active = counter === 1;

    // Set up the page to be collapsible
    pageEl.parentElement?.classList.add("tab-content");
    pageEl.id = id;
    pageEl.classList.add("tab-pane");
    pageEl.setAttribute("aria-labeled-by", `tab-${id}`);
    if (active) {
      pageEl.classList.add("show");
      pageEl.classList.add("active");
    } else {
      pageEl.classList.add(kDashboardGridSkip);
    }
    recursiveApplyFillClasses(pageEl);

    navItems.push({
      id,
      text: text !== null ? text : "Page " + counter,
      active,
    });
    counter++;
  }

  // Generate the navigation
  const navUlEl = makeEl("ul", {
    classes: ["navbar-nav", "navbar-nav-scroll", "me-auto"],
    attributes: { role: "tablist" },
  }, doc);
  for (const navItem of navItems) {
    navUlEl.append(toNav(navItem, doc));
  }

  // Generate a collapsible region
  const collapseEl = makeEl("div", {
    id: "collapse",
    classes: ["collapse", "navbar-collapse"],
  }, doc);
  collapseEl.append(navUlEl);

  navbarContainerEl.append(collapseEl);
}

function toNav(navItem: NavItem, doc: Document) {
  const liEl = makeEl("li", {
    classes: ["nav-item"],
    attributes: { role: "presentation" },
  }, doc);

  const classes = ["nav-link"];
  if (navItem.active) {
    classes.push("active");
  }

  const aEl = makeEl("a", {
    id: `tab-${navItem}`,
    classes,
    attributes: {
      "data-bs-toggle": "tab",
      "role": "tab",
      "data-bs-target": `#${navItem.id}`,
      "href": `#${navItem.id}`,
      "aria-controls": navItem.id,
      "aria-selected": navItem.active.toString(),
    },
  }, doc);

  const spanEl = makeEl("spand", {
    classes: ["nav-link-text"],
  }, doc);
  spanEl.innerText = navItem.text;
  aEl.append(spanEl);
  liEl.append(aEl);
  return liEl;
}
