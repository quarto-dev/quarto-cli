/*
 * format-dashboard-valuebox.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";

export function processValueBoxes(doc: Document) {
  // Process value boxes
  const valueboxNodes = doc.body.querySelectorAll(
    ".valuebox > .card-body > div",
  );
  for (const valueboxNode of valueboxNodes) {
    const valueboxEl = valueboxNode as Element;
    valueboxEl.classList.add("bslib-value-box");
    valueboxEl.classList.add("value-box-grid");
  }
}
