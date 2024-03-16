/*
 * format-dashboard-website.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document } from "../../core/deno-dom.ts";

export function processNavigation(doc: Document) {
  // Try to find an existing navbar header to target
  const websiteNavbarHeaderEl = doc.getElementById("quarto-header");
  if (websiteNavbarHeaderEl) {
    const dashboardHeaderEl = doc.getElementById("quarto-dashboard-header");
    if (dashboardHeaderEl) {
      websiteNavbarHeaderEl.appendChild(dashboardHeaderEl);
    }
  }
}
