/*
 * axe-signature.test.ts
 *
 * Tests the root-cause signature that `quarto dev-call axe` groups and
 * baselines on: `normalizeSelector` and `signatureOf` in
 * src/command/dev-call/axe/aggregate.ts.
 *
 * These are the most consequential lines in the scanner. A signature that is
 * too broad makes one accepted defect suppress unrelated conformance failures
 * across a whole site; one that is too narrow makes a baseline entry stop
 * matching the moment a counter changes. So the tests are written as explicit
 * should-collapse / must-stay-distinct pairs over selectors axe really emits on
 * Quarto output, rather than as assertions about the regexes themselves.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals, assertNotEquals } from "testing/asserts";
import {
  normalizeSelector,
  signatureOf,
} from "../../src/command/dev-call/axe/aggregate.ts";
import { AxeViolationNode } from "../../src/command/dev-call/axe/scan.ts";

function node(target: string[] | string): AxeViolationNode {
  return {
    html: "<div></div>",
    target: Array.isArray(target) ? target : [target],
  };
}

// ---------------------------------------------------------------------------
// Pairs that must collapse: the same defect, repeated by shared or generated
// code, has to be one finding with a count.
// ---------------------------------------------------------------------------

const kMustCollapse: [string, string, string][] = [
  [
    "collapsible callouts differing only by index",
    'div[data-bs-target=".callout-4-contents"]',
    'div[data-bs-target=".callout-11-contents"]',
  ],
  [
    "sidebar sections differing only by index",
    'a[data-bs-target="#quarto-sidebar-section-1"]',
    'a[data-bs-target="#quarto-sidebar-section-2"]',
  ],
  [
    "code blocks: Pandoc's #cb<n>-<n> ids",
    "#cb1-1 > code",
    "#cb12-3 > code",
  ],
  [
    "footnote backrefs: #fn<n>",
    "#fn3 > p > a",
    "#fn17 > p > a",
  ],
  [
    "nth-child position, which unrelated sibling edits change",
    "p:nth-child(3) > a",
    "p:nth-child(7) > a",
  ],
  [
    "href values, which differ per link but not per defect",
    'a[href="/docs/guide.html"]',
    'a[href="/docs/other.html"]',
  ],
  [
    "axe's bare-tag target versus the same tag with a position",
    "h6",
    "h6:nth-child(1)",
  ],
];

for (const [label, a, b] of kMustCollapse) {
  unitTest(
    `axe signature - collapses: ${label}`,
    // deno-lint-ignore require-await
    async () => {
      assertEquals(
        normalizeSelector(a),
        normalizeSelector(b),
        `expected these to share a signature:\n  ${a}\n  ${b}`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Pairs that must stay distinct. Every one of these is a way for an accepted
// finding to silently suppress an unrelated one.
// ---------------------------------------------------------------------------

const kMustStayDistinct: [string, string, string][] = [
  [
    "a callout and a modal both hang off data-bs-target",
    'div[data-bs-target=".callout-4-contents"]',
    'button[data-bs-target="#exampleModal"]',
  ],
  [
    "a callout and a carousel both hang off data-bs-target",
    'div[data-bs-target=".callout-4-contents"]',
    'button[data-bs-target="#carouselExampleControls"]',
  ],
  [
    "a sidebar link and a tabset link both hang off data-bs-target",
    'a[data-bs-target="#quarto-sidebar-section-1"]',
    'a[data-bs-target="#tabset-1-1"]',
  ],
  [
    "data-anchor-id values are content slugs, so headings are separate",
    'h4[data-anchor-id="markdown-syntax"]',
    'h4[data-anchor-id="latex-raw-blocks"]',
  ],
  [
    "the same slug at different heading levels is a different heading",
    'h4[data-anchor-id="markdown-syntax"]',
    'h6[data-anchor-id="markdown-syntax"]',
  ],
  [
    "an image in a layout cell versus a bare paragraph image",
    ".quarto-layout-cell > p > .img-fluid",
    "p > .img-fluid",
  ],
  [
    "different rules never share a signature even with one selector",
    "h6",
    "th",
  ],
  [
    "htmlwidget instances keep their hashes apart",
    "#htmlwidget-9f0c1b2a3d4e",
    "#htmlwidget-aa11bb22cc33",
  ],
];

for (const [label, a, b] of kMustStayDistinct) {
  unitTest(
    `axe signature - keeps distinct: ${label}`,
    // deno-lint-ignore require-await
    async () => {
      assertNotEquals(
        normalizeSelector(a),
        normalizeSelector(b),
        `these must not share a signature:\n  ${a}\n  ${b}`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Exact output, so a scheme change is visible in a diff rather than inferred
// from a collapse count. Update these together with kSignatureScheme.
// ---------------------------------------------------------------------------

const kExactOutput: [string, string][] = [
  [
    'div[data-bs-target=".callout-4-contents"]',
    'div[data-bs-target=".callout-*-contents"]',
  ],
  ['a[data-bs-target="#tabset-1-1"]', 'a[data-bs-target="#tabset-*-*"]'],
  [
    'h4[data-anchor-id="markdown-syntax"]',
    'h4[data-anchor-id="markdown-syntax"]',
  ],
  ["#cb12-3 > code", "#cb > code"],
  ["#fn17 > p > a", "#fn > p > a"],
  ["p:nth-child(3) > a", "p > a"],
  ['a[href="/docs/guide.html"]', "a"],
  ['div[id="quarto-content"][data-index="3"]', "div"],
  ['input[name="search-input"]', "input"],
  ['img[src="elephant.png"][style="width:60px"]', 'img[src="elephant.png"]'],
  ["#download-news > h6", "#download-news > h6"],
];

for (const [input, expected] of kExactOutput) {
  unitTest(
    `axe signature - normalizes ${input} -> ${expected}`,
    // deno-lint-ignore require-await
    async () => {
      assertEquals(normalizeSelector(input), expected);
    },
  );
}

unitTest(
  "axe signature - axe's target array is joined into a descendant path",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      normalizeSelector([".quarto-layout-cell", "p", ".img-fluid"]),
      ".quarto-layout-cell > p > .img-fluid",
    );
  },
);

// ---------------------------------------------------------------------------
// signatureOf: rule prefix, and the color-contrast special case
// ---------------------------------------------------------------------------

unitTest(
  "signatureOf - prefixes the rule id, so two rules never collide",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      signatureOf("heading-order", node("h6")),
      "heading-order :: h6",
    );
    assertNotEquals(
      signatureOf("heading-order", node("h6")),
      signatureOf("empty-heading", node("h6")),
    );
  },
);

unitTest(
  "signatureOf - color-contrast keys on the colour pair, not the location",
  // deno-lint-ignore require-await
  async () => {
    const contrastNode = (target: string): AxeViolationNode => ({
      html: "<p></p>",
      target: [target],
      any: [{
        id: "color-contrast",
        data: { fgColor: "#767676", bgColor: "#ffffff" },
      }],
    });
    // The root cause is one theme colour pair, so unrelated elements sharing it
    // are one finding rather than one per element.
    assertEquals(
      signatureOf("color-contrast", contrastNode(".sidebar-link")),
      "color-contrast :: #767676 on #ffffff",
    );
    assertEquals(
      signatureOf("color-contrast", contrastNode("p > code")),
      signatureOf("color-contrast", contrastNode(".sidebar-link")),
    );
  },
);

unitTest(
  "signatureOf - color-contrast falls back to the selector without colour data",
  // deno-lint-ignore require-await
  async () => {
    // A payload with no color-contrast check result must not produce
    // "undefined on undefined" and collapse every contrast finding into one.
    const signature = signatureOf("color-contrast", node(".sidebar-link"));
    assertEquals(signature, "color-contrast :: .sidebar-link");
    assert(!signature.includes("undefined"));
  },
);
