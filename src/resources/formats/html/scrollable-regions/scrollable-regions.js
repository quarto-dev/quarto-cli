/*
 * scrollable-regions.js
 *
 * Makes scrollable code blocks and cell output keyboard-focusable while they
 * actually overflow, so keyboard users can Tab to them and scroll with the
 * arrow keys (axe scrollable-region-focusable, WCAG 2.1.1). Chrome 132+ and
 * Firefox already focus such scrollers natively; this adds Safari coverage
 * and an accessible name, and keeps the attributes in sync so a region that
 * stops overflowing stops being a tab stop.
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

// Marker for attributes we added, so removal never touches author markup.
const kMarker = "data-quarto-scrollable";

// Scroll containers in rendered HTML: Pandoc emits
// `div.sourceCode { overflow: auto }` for highlighted code, the Bootstrap
// reboot gives every `pre` `overflow: auto`, and _quarto-rules.scss gives
// `.cell-output-display:not(.no-overflow-x)` `overflow-x: auto`.
const kCandidateSelector =
  "div.sourceCode, pre, .cell-output-display:not(.no-overflow-x)";

// Mirrors axe's pass condition (and Chrome's native heuristic): a region with
// focusable content is already keyboard-reachable, and adding tabindex would
// create a double tab stop.
const kFocusableSelector =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

const kDefaultLabels = {
  code: "Scrollable code",
  output: "Scrollable output",
};

// Merge configured labels over the English defaults, ignoring missing or
// non-string values (e.g. a language file without the new keys).
export function resolveLabels(labels) {
  const resolved = { ...kDefaultLabels };
  for (const key of Object.keys(kDefaultLabels)) {
    if (labels && typeof labels[key] === "string" && labels[key] !== "") {
      resolved[key] = labels[key];
    }
  }
  return resolved;
}

// A region scrolls when its content overflows its box in either axis; the 1px
// tolerance absorbs subpixel rounding. Pure over the four metrics so it works
// on hand-built geometry as well as elements.
export function isScrollable(el) {
  return (
    el.scrollWidth - el.clientWidth > 1 || el.scrollHeight - el.clientHeight > 1
  );
}

function labelFor(el, labels) {
  if (el.matches(".cell-output-display") || el.closest(".cell-output")) {
    return labels.output;
  }
  return labels.code;
}

export function syncScrollableRegions(labels) {
  labels = resolveLabels(labels || window.quartoScrollableRegionsLabels);
  for (const el of document.querySelectorAll(kCandidateSelector)) {
    // hidden (closed <details>, inactive tab pane): geometry reads 0, leave as is
    if (el.clientWidth === 0) {
      continue;
    }
    if (!el.hasAttribute(kMarker)) {
      // respect author markup and regions with their own tab stops
      if (
        el.hasAttribute("tabindex") ||
        el.hasAttribute("aria-label") ||
        el.querySelector(kFocusableSelector)
      ) {
        continue;
      }
      if (isScrollable(el)) {
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "group");
        el.setAttribute("aria-label", labelFor(el, labels));
        el.setAttribute(kMarker, "");
      }
    } else if (!isScrollable(el) && el !== document.activeElement) {
      el.removeAttribute("tabindex");
      el.removeAttribute("role");
      el.removeAttribute("aria-label");
      el.removeAttribute(kMarker);
    }
  }
}
