/*
 * axe-mode-discovery.test.ts
 *
 * Tests how `quarto dev-call axe` discovers a page's colour modes from its
 * rendered HTML, and how `--themes` filters the discovered matrix.
 *
 * The HTML snippets here are distillations of what Quarto really emits — the
 * before-body script marker and the bootstrap link shapes are pinned against
 * live renders by the smoke tests (sites/matrix, sites/brand-light-only,
 * sites/darkly); these tests pin the sniffer's reading of each shape.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals, assertThrows } from "testing/asserts";
import {
  applyThemesFilter,
  AxePage,
  sniffModes,
} from "../../src/command/dev-call/axe/discover.ts";

// The inline before-body script, boiled down to its marker. Quarto emits it
// iff the page has two modes.
const kTwoModeHtml = `<html><head>
<link href="site_libs/bootstrap/bootstrap-b1.min.css" rel="stylesheet" class="quarto-color-scheme" id="quarto-bootstrap" data-mode="light">
<link href="site_libs/bootstrap/bootstrap-dark-c2.min.css" rel="disabled-stylesheet" class="quarto-color-scheme quarto-color-alternate" id="quarto-bootstrap" data-mode="dark">
<script id="quarto-html-before-body">
  window.quartoToggleColorScheme = () => {};
</script>
</head><body class="quarto-light"></body></html>`;

// theme: darkly — one bootstrap link, measured dark, no script, no toggle.
const kDarklyHtml = `<html><head>
<link href="site_libs/bootstrap/bootstrap-d3.min.css" rel="stylesheet" id="quarto-bootstrap" data-mode="dark">
</head><body class="quarto-light"></body></html>`;

// A light-only _brand.yml: the full colour-scheme link set — one of them an
// alternate pointing at a dark Bootstrap build — but no before-body script.
// All the links measure light.
const kBrandLightOnlyHtml = `<html><head>
<link href="site_libs/bootstrap/bootstrap-e4.min.css" rel="stylesheet" class="quarto-color-scheme" id="quarto-bootstrap" data-mode="light">
<link href="site_libs/bootstrap/bootstrap-dark-f5.min.css" rel="disabled-stylesheet" class="quarto-color-scheme quarto-color-alternate" id="quarto-bootstrap" data-mode="light">
<link href="site_libs/bootstrap/bootstrap-e4.min.css" rel="stylesheet" class="quarto-color-scheme-extra" id="quarto-bootstrap" data-mode="light">
</head><body class="quarto-light"></body></html>`;

const kStaticHtml = `<html><head><title>legacy</title></head>
<body><p>hand-written; no Quarto markers at all</p></body></html>`;

unitTest(
  "mode discovery - the before-body script marker means two modes",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(sniffModes(kTwoModeHtml), {
      modes: ["light", "dark"],
      darkColoured: false,
    });
  },
);

unitTest(
  "mode discovery - no marker means one mode, whatever the links say",
  // deno-lint-ignore require-await
  async () => {
    // The light-only-brand trap: alternate links and a dark Bootstrap href
    // with no dark mode behind them. An "alternate link exists" probe reads
    // this as two modes; the sniffer must not.
    assertEquals(sniffModes(kBrandLightOnlyHtml), {
      modes: ["default"],
      darkColoured: false,
    });
    assertEquals(sniffModes(kStaticHtml), {
      modes: ["default"],
      darkColoured: false,
    });
  },
);

unitTest(
  "mode discovery - a sole dark-measured bootstrap link is annotated, not a mode",
  // deno-lint-ignore require-await
  async () => {
    // theme: darkly — one presentation, dark-coloured. The annotation is the
    // only rendered signal; the cell still scans once, as `default`.
    assertEquals(sniffModes(kDarklyHtml), {
      modes: ["default"],
      darkColoured: true,
    });
  },
);

// ---------------------------------------------------------------------------
// --themes as a filter over the discovered matrix
// ---------------------------------------------------------------------------

function page(path: string, modes: AxePage["modes"]): AxePage {
  return { path, modes, darkColoured: false };
}

unitTest(
  "themes filter - prunes the pair, always keeps default cells",
  // deno-lint-ignore require-await
  async () => {
    const pages = [
      page("a.html", ["light", "dark"]),
      page("b.html", ["default"]),
    ];
    assertEquals(
      applyThemesFilter(pages, ["dark"]).map((p) => p.modes),
      [["dark"], ["default"]],
    );
    assertEquals(
      applyThemesFilter(pages, ["light"]).map((p) => p.modes),
      [["light"], ["default"]],
    );
  },
);

unitTest(
  "themes filter - the default filter is a no-op",
  // deno-lint-ignore require-await
  async () => {
    // Both values requested means no narrowing — including on a site with no
    // two-mode pages at all, which is just a plain site scanning normally.
    const pages = [page("a.html", ["default"])];
    assertEquals(applyThemesFilter(pages, ["light", "dark"]), pages);
  },
);

unitTest(
  "themes filter - matching zero cells is an error, not an empty scan",
  // deno-lint-ignore require-await
  async () => {
    // Asking for dark on a site with no light/dark pair must not quietly scan
    // every page once and read as dark coverage.
    const pages = [page("a.html", ["default"]), page("b.html", ["default"])];
    assertThrows(
      () => applyThemesFilter(pages, ["dark"]),
      Error,
      "matched no cells",
    );
  },
);
