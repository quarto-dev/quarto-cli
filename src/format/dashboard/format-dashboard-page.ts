/*
 * format-dashboard-page.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";
import { recursiveApplyFillClasses } from "./format-dashboard-layout.ts";
import {
  DashboardMeta,
  kDashboardGridSkip,
  makeEl,
} from "./format-dashboard-shared.ts";

const kPageClass = "dashboard-page";
const kAttrTitle = "data-title";
const kAttrScrolling = "data-scrolling";

const kDashboardPagesClass = "quarto-dashboard-pages";

interface NavItem {
  id: string;
  text: string;
  active: boolean;
  scrolling: boolean;
}

export function processPages(doc: Document, dashboardMeta: DashboardMeta) {
  // Find the pages, if any
  const pageNodes = doc.querySelectorAll(`.${kPageClass}`);
  if (pageNodes.length === 0) {
    // No pages to process, audi 5000
    return;
  }

  // Decorate the container
  const contentEl = doc.querySelector(".quarto-dashboard-content");
  if (contentEl !== null) {
    contentEl.classList.add(kDashboardPagesClass);
  }

  // Find the navbar, which will be using to make navigation
  const navbarEl = doc.querySelector("#quarto-dashboard-header .navbar");
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

  // Mark the toggle button visible
  const navbarTogglerEl = navbarEl.querySelector(".navbar-toggler");
  if (navbarTogglerEl) {
    navbarTogglerEl.classList.remove("hidden");
  }

  // Add a dark mode toggle if needed
  // If dark and light themes are provided, inject a toggle into the correct spot
  if (dashboardMeta.hasDarkMode) {
    const toggleEl = makeEl("a", {
      classes: ["quarto-color-scheme-toggle"],
      attributes: {
        href: "",
        onclick: "window.quartoToggleColorScheme(); return false;",
      },
    }, doc);

    const iEl = makeEl("i", { classes: ["bi"] }, doc);
    toggleEl.append(iEl);
    navbarContainerEl.append(toggleEl);
  }

  // Build up the navigation descriptors, marking up the pages as we go
  const navItems: NavItem[] = [];
  let counter = 1;
  for (const pageNode of pageNodes) {
    const pageEl = pageNode as Element;

    const scrolling = pageEl.getAttribute(kAttrScrolling) !== null
      ? pageEl.getAttribute(kAttrScrolling) === "true"
      : dashboardMeta.scrolling;
    const id = pageEl.id ? pageEl.id : "dashboard-page-" + counter;
    const text = pageEl.getAttribute(kAttrTitle);
    pageEl.removeAttribute(kAttrTitle);
    const active = counter === 1;

    // Set up the page to be collapsible
    pageEl.parentElement?.classList.add("tab-content");
    pageEl.id = id;
    pageEl.classList.add("tab-pane");
    pageEl.setAttribute("aria-labelledby", `tab-${id}`);
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
      scrolling,
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
    id: "dashboard-collapse",
    classes: ["navbar-collapse", "collapse"],
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
    id: `tab-${navItem.id}`,
    classes,
    attributes: {
      "data-bs-toggle": "tab",
      "role": "tab",
      "data-bs-target": `#${navItem.id}`,
      [kAttrScrolling]: navItem.scrolling.toString(),
      "href": `#${navItem.id}`,
      "aria-controls": navItem.id,
      "aria-selected": navItem.active.toString(),
    },
  }, doc);

  const spanEl = makeEl("span", {
    classes: ["nav-link-text"],
  }, doc);
  spanEl.innerText = navItem.text;
  aEl.append(spanEl);
  liEl.append(aEl);
  return liEl;
}
