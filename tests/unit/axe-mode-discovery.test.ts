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
import { join } from "../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../src/deno_ral/fs.ts";
import {
  applyThemesFilter,
  AxePage,
  discoverPages,
  sniffModes,
  sniffRedirectStub,
} from "../../src/command/dev-call/axe/discover.ts";
import { axeScanConfig } from "../../src/command/dev-call/axe/config.ts";
import { withTempDir } from "../utils.ts";

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
// Page discovery: the walk, its skips, and the --pages / --max-pages narrowing
// ---------------------------------------------------------------------------

/** A site dir on disk: every entry is a page written with static one-mode HTML. */
function writeSite(dir: string, pages: string[]) {
  for (const page of pages) {
    ensureDirSync(join(dir, page, ".."));
    Deno.writeTextFileSync(join(dir, page), kStaticHtml);
  }
}

unitTest(
  "page discovery - the scanner's own output and vendored libs are never pages",
  async () => {
    await withTempDir((dir) => {
      writeSite(dir, [
        "index.html",
        "docs/guide.html",
        // a previous run's report, when the anchor is the site dir
        "_axe-checks/report.html",
        // vendored: reveal ships this with every deck
        "site_libs/revealjs/plugin/notes/speaker-view.html",
        // nested site_libs (a deck rendered into a subdirectory)
        "slides/site_libs/quarto-html/tippy.html",
      ]);
      const { pages } = discoverPages(axeScanConfig({}, dir));
      assertEquals(
        pages.map((page) => page.path),
        ["docs/guide.html", "index.html"],
      );
    });
  },
);

// quarto's redirect-simple.ejs shape (also positron-website's _redirects stubs)
const kMetaRefreshStub = `<html><head><title>Redirect</title>
<meta http-equiv="refresh" content="0; url=https://example.com/moved/">
</head><body><p>Redirecting…</p></body></html>`;

// quarto's redirect-map.ejs shape, written for aliases: front matter
const kAliasStub = `<html><head><title>Redirect</title>
<script type="text/javascript">
  var redirects = {"":"download.html"};
  window.location.replace(redirects[""]);
</script></head><body></body></html>`;

unitTest(
  "page discovery - redirect stubs are set aside, recorded with a destination",
  async () => {
    await withTempDir((dir) => {
      writeSite(dir, ["index.html"]);
      Deno.writeTextFileSync(join(dir, "old.html"), kMetaRefreshStub);
      Deno.writeTextFileSync(join(dir, "install.html"), kAliasStub);
      const { pages, redirects } = discoverPages(axeScanConfig({}, dir));
      assertEquals(pages.map((page) => page.path), ["index.html"]);
      assertEquals(redirects, [
        { path: "install.html", to: "download.html" },
        { path: "old.html", to: "https://example.com/moved/" },
      ]);
    });
  },
);

unitTest(
  "page discovery - a content page about redirects is not a stub",
  // deno-lint-ignore require-await
  async () => {
    // The markers alone must not classify: a docs page quoting the redirect
    // script in an unhighlighted code block carries them verbatim, but a real
    // page has real body content where a stub's body is bytes.
    const docsPage = `<html><head><title>Using aliases</title></head><body>
<pre><code>var redirects = {"":"download.html"};
window.location.replace(redirects[""]);</code></pre>
${
      "<p>Documentation prose about how alias redirects work in Quarto.</p>"
        .repeat(20)
    }
</body></html>`;
    assertEquals(sniffRedirectStub(docsPage), undefined);
    assertEquals(sniffRedirectStub(kMetaRefreshStub), {
      to: "https://example.com/moved/",
    });
    assertEquals(sniffRedirectStub(kAliasStub), { to: "download.html" });
  },
);

unitTest(
  "page discovery - --pages narrows, --exclude prunes, --max-pages caps",
  async () => {
    await withTempDir((dir) => {
      writeSite(dir, [
        "index.html",
        "docs/a.html",
        "docs/b.html",
        "blog/post.html",
        "slides/deck.html",
      ]);
      // globstar include
      assertEquals(
        discoverPages(axeScanConfig({ pages: "docs/**" }, dir))
          .pages.map((page) => page.path),
        ["docs/a.html", "docs/b.html"],
      );
      // exclude alone: everything but the decks (the resting-DOM opt-out)
      assertEquals(
        discoverPages(axeScanConfig({ exclude: "slides/**" }, dir))
          .pages.map((page) => page.path),
        ["blog/post.html", "docs/a.html", "docs/b.html", "index.html"],
      );
      // a bare directory name means everything beneath it, not nothing
      assertEquals(
        discoverPages(axeScanConfig({ exclude: "slides" }, dir))
          .pages.map((page) => page.path),
        ["blog/post.html", "docs/a.html", "docs/b.html", "index.html"],
      );
      // exclude applies after include, and before the cap — pruning frees cap
      // room for the pages that remain
      assertEquals(
        discoverPages(
          axeScanConfig(
            { pages: "docs/**,slides/**", exclude: "slides/**", maxPages: 2 },
            dir,
          ),
        ).pages.map((page) => page.path),
        ["docs/a.html", "docs/b.html"],
      );
      // the cap is deterministic: sorted first, then sliced
      assertEquals(
        discoverPages(axeScanConfig({ maxPages: 2 }, dir))
          .pages.map((page) => page.path),
        ["blog/post.html", "docs/a.html"],
      );
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
