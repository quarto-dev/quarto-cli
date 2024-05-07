/*
 * format-dashboard-shiny.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";

export function processShinyComponents(doc: Document) {
  // Deal with input containers
  const inputContainerNodes = doc.querySelectorAll(".shiny-input-container");
  for (const inputContainerNode of inputContainerNodes) {
    const inputContainerEl = inputContainerNode as Element;

    // See if the container has a slider and adjust the flexbox
    const sliderEl = inputContainerEl.querySelector("input.js-range-slider");
    if (sliderEl) {
      inputContainerEl.classList.add("no-baseline");
    }
  }
}
