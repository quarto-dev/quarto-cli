/*
 * axe-aggregate.test.ts
 *
 * Tests the aggregate stage of `quarto dev-call axe` against real captured axe
 * payloads: grouping, the systemic/localized call, matrix coverage, and the
 * `findings.json` contract.
 *
 * The inputs are verbatim per-cell captures from a scan of
 * tests/docs/axe-scan/site (see tests/docs/axe-scan/cells/README.md), so these
 * exercise genuine axe-core output shape without a browser. Baseline
 * reconciliation is tested separately, in axe-baseline-reconcile.test.ts, with
 * hand-built cells — there the point is precise control, not fidelity.
 *
 * Assertions look findings up by signature rather than by index or count. The
 * fixture also produces findings from Quarto's own navbar, which belong to
 * Quarto and may change on upgrade; a test that counted them would fail for
 * reasons that have nothing to do with this code.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { aggregate } from "../../src/command/dev-call/axe/aggregate.ts";
import { AxeCell } from "../../src/command/dev-call/axe/scan.ts";
import {
  axeFindingsSchema,
  kSignatureScheme,
} from "../../src/command/dev-call/axe/schemas.ts";
import { AxeScanConfig } from "../../src/command/dev-call/axe/config.ts";
import { docs } from "../utils.ts";

const kCellNames = [
  "about__1440x900__light",
  "index__1440x900__light",
  "index__390x844__light",
  "media__1440x900__light",
  "media__1440x900__dark",
  "media__390x844__light",
  "media__390x844__dark",
  "static_legacy__1440x900__light",
];

function capturedCells(): AxeCell[] {
  return kCellNames.map((name) =>
    JSON.parse(
      Deno.readTextFileSync(join(docs("axe-scan/cells"), `${name}.json`)),
    ) as AxeCell
  );
}

const kConfig: AxeScanConfig = {
  siteDir: "_site",
  viewports: [
    { width: 1440, height: 900, label: "1440x900" },
    { width: 390, height: 844, label: "390x844" },
  ],
  themes: ["light", "dark"],
  timeout: 30000,
  settle: 500,
};

function aggregateCaptured(cells = capturedCells()) {
  return aggregate({
    cells,
    config: kConfig,
    baseline: { findings: [] },
    baselineFile: "_axe-baseline.json",
    pages: [...new Set(cells.map((cell) => cell.page))].sort(),
  });
}

function bySignature(signature: string) {
  const results = aggregateCaptured();
  const finding = results.findings.find((f) => f.signature === signature);
  assert(
    finding,
    `no finding with signature '${signature}'. Present:\n  ` +
      results.findings.map((f) => f.signature).join("\n  "),
  );
  return finding;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

unitTest(
  "aggregate - one defect in a shared include is one systemic finding",
  // deno-lint-ignore require-await
  async () => {
    // The alt-less image lives in _systemic.qmd, included by every content
    // page. Three pages, one finding, not three.
    const finding = bySignature("image-alt :: img");
    assertEquals(finding.label, "systemic");
    assertEquals(finding.impact, "critical");
    assertEquals(finding.pages, ["about.html", "index.html", "media.html"]);
    assertEquals(finding.instances, 3);
  },
);

unitTest(
  "aggregate - a one-off is localized",
  // deno-lint-ignore require-await
  async () => {
    const finding = bySignature("link-name :: p > a");
    assertEquals(finding.label, "localized");
    assertEquals(finding.impact, "serious");
    assertEquals(finding.pages, ["index.html"]);
    assertEquals(finding.instances, 1);
  },
);

unitTest(
  "aggregate - three elements on one page are systemic without a second page",
  // deno-lint-ignore require-await
  async () => {
    // Repetition within a page is as much evidence of a shared source as
    // repetition across pages.
    const finding = bySignature(
      'button-name :: button[data-widget-target="#panel-*"]',
    );
    assertEquals(finding.label, "systemic");
    assertEquals(finding.pages.length, 1);
    assertEquals(finding.instances, 3);
  },
);

unitTest(
  "aggregate - a different component on the same attribute stays separate",
  // deno-lint-ignore require-await
  async () => {
    // The whole point of keeping attribute values: accepting the panels must
    // not silence the dialog.
    const panels = bySignature(
      'button-name :: button[data-widget-target="#panel-*"]',
    );
    const dialog = bySignature(
      'button-name :: button[data-widget-target="#settings-dialog"]',
    );
    assert(panels.id !== dialog.id);
    assertEquals(dialog.instances, 1);
  },
);

unitTest(
  "aggregate - volatile attributes collapse instances of one defect",
  // deno-lint-ignore require-await
  async () => {
    // Two images differing only in id and style: one finding.
    const finding = bySignature("image-alt :: #hero");
    assertEquals(finding.instances, 2);
    assertEquals(finding.pages, ["static/legacy.html"]);
  },
);

unitTest(
  "aggregate - occurrences keep the raw selector, not the normalized one",
  // deno-lint-ignore require-await
  async () => {
    // The signature is lossy on purpose, so the un-normalized target has to
    // survive somewhere: it is what a re-signature migration reads.
    const finding = bySignature("image-alt :: #hero");
    const targets = finding.occurrences.map((o) => o.target).sort();
    assertEquals(targets, ["#hero-14", "#hero-15"]);
    for (const occurrence of finding.occurrences) {
      assert(occurrence.html.includes("<img"), occurrence.html);
    }
  },
);

// ---------------------------------------------------------------------------
// The matrix: findings that only exist in some cells
// ---------------------------------------------------------------------------

unitTest(
  "aggregate - a dark-only failure is recorded against dark cells only",
  // deno-lint-ignore require-await
  async () => {
    const finding = bySignature("color-contrast :: #555555 on #333333");
    assertEquals(finding.themes, ["dark"]);
    // present at both widths, so it is the theme axis that found it
    assertEquals(finding.viewports, ["1440x900", "390x844"]);
  },
);

unitTest(
  "aggregate - a mobile-only failure is recorded against the narrow viewport only",
  // deno-lint-ignore require-await
  async () => {
    const finding = bySignature("color-contrast :: #f8f8f8 on #f0f0f0");
    assertEquals(finding.viewports, ["390x844"]);
    assertEquals(finding.themes, ["dark", "light"]);
  },
);

unitTest(
  "aggregate - color-contrast groups on the colour pair across elements",
  // deno-lint-ignore require-await
  async () => {
    // The root cause is one pair of colours in the theme, so the signature
    // names the pair and the detail carries the measured ratio.
    const finding = bySignature("color-contrast :: #555555 on #333333");
    assert(finding.detail, "expected a detail string");
    assert(
      finding.detail!.includes("#555555 on #333333"),
      finding.detail!,
    );
    assert(finding.detail!.includes("needs"), finding.detail!);
  },
);

unitTest(
  "aggregate - a finding records every cell it reproduced in",
  // deno-lint-ignore require-await
  async () => {
    // media.html contributes four cells and the include's image fails in all
    // of them; index contributes two and about one.
    const finding = bySignature("image-alt :: img");
    assertEquals(finding.cells, 7);
    const media = finding.occurrences.find((o) => o.page === "media.html");
    assert(media);
    assertEquals(media!.cells, [
      "1440x900·dark",
      "1440x900·light",
      "390x844·dark",
      "390x844·light",
    ]);
  },
);

// ---------------------------------------------------------------------------
// Labelling
// ---------------------------------------------------------------------------

unitTest(
  "aggregate - conformance labels come from axe's tags",
  // deno-lint-ignore require-await
  async () => {
    const imageAlt = bySignature("image-alt :: img");
    assertEquals(imageAlt.standard, "WCAG 2.0 A");
    assert(
      imageAlt.conformance.startsWith("WCAG 2.0 A ("),
      imageAlt.conformance,
    );
    assertEquals(imageAlt.bestPractice, false);

    const headingOrder = bySignature("heading-order :: h4");
    assertEquals(headingOrder.standard, "Best Practice");
    assertEquals(headingOrder.bestPractice, true);
  },
);

unitTest(
  "aggregate - findings are ordered by standard, then severity",
  // deno-lint-ignore require-await
  async () => {
    const results = aggregateCaptured();
    for (let i = 1; i < results.findings.length; i++) {
      const previous = results.findings[i - 1];
      const current = results.findings[i];
      const ordered = previous.standardRank < current.standardRank ||
        (previous.standardRank === current.standardRank &&
          previous.severityRank <= current.severityRank);
      assert(
        ordered,
        `out of order at ${i}: ${previous.signature} (${previous.standardRank}/` +
          `${previous.severityRank}) before ${current.signature} ` +
          `(${current.standardRank}/${current.severityRank})`,
      );
    }
  },
);

// ---------------------------------------------------------------------------
// The findings.json contract
// ---------------------------------------------------------------------------

unitTest(
  "aggregate - output satisfies the published findings schema",
  // deno-lint-ignore require-await
  async () => {
    const parsed = axeFindingsSchema.safeParse(aggregateCaptured());
    assert(
      parsed.success,
      parsed.success ? "" : JSON.stringify(parsed.error.issues, null, 2),
    );
  },
);

unitTest(
  "aggregate - output declares its schema version and signature scheme",
  // deno-lint-ignore require-await
  async () => {
    const results = aggregateCaptured();
    assertEquals(results.version, 1);
    assertEquals(results.signatureScheme, kSignatureScheme);
  },
);

unitTest(
  "aggregate - the config echo records what was scanned",
  // deno-lint-ignore require-await
  async () => {
    const results = aggregateCaptured();
    assertEquals(results.config.viewports, ["1440x900", "390x844"]);
    assertEquals(results.config.themes, ["light", "dark"]);
    assertEquals(results.config.pages, null);
    assertEquals(results.config.maxPages, null);
  },
);

unitTest(
  "aggregate - cell accounting counts ok and not-ok separately",
  // deno-lint-ignore require-await
  async () => {
    const cells = capturedCells();
    const timedOut: AxeCell = {
      page: "slow.html",
      viewport: "1440x900",
      theme: "light",
      url: "http://127.0.0.1/slow.html",
      status: "timeout",
      message: "cell exceeded --timeout of 30000ms",
      elapsed: 30001,
    };
    const results = aggregateCaptured([...cells, timedOut]);
    assertEquals(results.cells.total, cells.length + 1);
    assertEquals(results.cells.ok, cells.length);
    assertEquals(results.cells.notOk, 1);
    assertEquals(results.notOkCells.length, 1);
    assertEquals(results.notOkCells[0].page, "slow.html");
    assertEquals(results.notOkCells[0].status, "timeout");
  },
);

unitTest(
  "aggregate - a not-ok cell contributes no findings",
  // deno-lint-ignore require-await
  async () => {
    // Fail-closed: an incomplete cell must never read as a clean one, so its
    // absence of violations must not be mistaken for a pass.
    const errored: AxeCell = {
      page: "broken.html",
      viewport: "1440x900",
      theme: "light",
      url: "http://127.0.0.1/broken.html",
      status: "error",
      message: "axe injection failed",
      elapsed: 12,
    };
    const results = aggregateCaptured([errored]);
    assertEquals(results.findings.length, 0);
    assertEquals(results.pagesScanned, 0);
    assertEquals(results.cells.notOk, 1);
  },
);

unitTest(
  "aggregate - pagesScanned counts pages with an ok cell",
  // deno-lint-ignore require-await
  async () => {
    const results = aggregateCaptured();
    assertEquals(results.pagesScanned, 4);
    assertEquals(results.pages.map((p) => p.output), [
      "about.html",
      "index.html",
      "media.html",
      "static/legacy.html",
    ]);
  },
);

unitTest(
  "aggregate - finding ids are stable across runs and derived from the signature",
  // deno-lint-ignore require-await
  async () => {
    const first = aggregateCaptured();
    const second = aggregateCaptured();
    assertEquals(
      first.findings.map((f) => f.id),
      second.findings.map((f) => f.id),
    );
    for (const finding of first.findings) {
      assert(
        finding.id.startsWith(`${finding.rule}-`),
        `${finding.id} should be prefixed with ${finding.rule}`,
      );
    }
  },
);
