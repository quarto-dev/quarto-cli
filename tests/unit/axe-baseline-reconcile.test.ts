/*
 * axe-baseline-reconcile.test.ts
 *
 * Tests how the aggregate stage reconciles findings against the hand-written
 * ledger: which findings come out `known`, which re-alert as `new`, and which
 * ledger entries are reported stale.
 *
 * These use hand-built cells rather than captured ones. The captures in
 * axe-aggregate.test.ts prove the aggregate stage reads real axe output; here
 * the point is control — each test needs one finding, on exactly the pages it
 * says, at exactly the impact it says, so the outcome under test is the only
 * thing that varies.
 *
 * Every re-alert case matters more than the accepts. An acceptance that is too
 * broad hides a real conformance failure, which is the failure mode a
 * suppression mechanism has to be trusted not to have.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { aggregate } from "../../src/command/dev-call/axe/aggregate.ts";
import { AxeCell } from "../../src/command/dev-call/axe/scan.ts";
import {
  AxeBaseline,
  AxeFindings,
  AxeImpact,
} from "../../src/command/dev-call/axe/schemas.ts";
import { AxeScanConfig } from "../../src/command/dev-call/axe/config.ts";

const kConfig: AxeScanConfig = {
  siteDir: "_site",
  viewports: [{ width: 1440, height: 900, label: "1440x900" }],
  themes: ["light"],
  timeout: 30000,
  settle: 500,
};

/** A cell carrying one `link-name` violation on one element. */
function cell(page: string, target: string, impact: AxeImpact): AxeCell {
  return {
    page,
    viewport: "1440x900",
    theme: "light",
    url: `http://127.0.0.1/${page}`,
    status: "ok",
    elapsed: 100,
    result: {
      violations: [{
        id: "link-name",
        impact,
        tags: ["cat.name-role-value", "wcag2a", "wcag412"],
        description: "Links must have discernible text",
        help: "Links must have discernible text",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.10/link-name",
        nodes: [{
          html: `<a href="#"></a>`,
          target: [target],
          failureSummary: "Fix any of the following:\n  Element has no title",
        }],
      }],
      testEngine: { name: "axe-core", version: "4.10.3" },
    },
  };
}

/** The signature `cell()` produces for a bare `a` target. */
const kSignature = "link-name :: a";

function run(cells: AxeCell[], baseline: AxeBaseline): AxeFindings {
  return aggregate({
    cells,
    config: kConfig,
    baseline,
    baselineFile: "_axe-baseline.json",
    anchor: Deno.cwd(),
    pages: [...new Set(cells.map((c) => c.page))].sort().map((path) => ({
      path,
      modes: ["light"],
      darkColoured: false,
    })),
  });
}

function entry(
  overrides: Partial<AxeBaseline["findings"][number]> = {},
): AxeBaseline["findings"][number] {
  return {
    signature: kSignature,
    pages: [],
    impact: "serious",
    note: "accepted for test",
    ...overrides,
  };
}

function onlyFinding(results: AxeFindings) {
  const finding = results.findings.find((f) => f.signature === kSignature);
  assert(finding, `expected a finding for ${kSignature}`);
  return finding!;
}

// ---------------------------------------------------------------------------
// Accepting
// ---------------------------------------------------------------------------

unitTest(
  "reconcile - an empty pages list accepts the signature site-wide",
  // deno-lint-ignore require-await
  async () => {
    // The shape for shared chrome: the same defect on a page added later must
    // not re-alert.
    const results = run(
      [cell("index.html", "a", "serious"), cell("about.html", "a", "serious")],
      { findings: [entry({ pages: [] })] },
    );
    const finding = onlyFinding(results);
    assertEquals(finding.baselined, true);
    assertEquals(finding.baselineNote, "accepted for test");
    assertEquals(results.counts.baselined, 1);
    assertEquals(results.counts.new, 0);
  },
);

unitTest(
  "reconcile - a page-scoped entry accepts when it covers every affected page",
  // deno-lint-ignore require-await
  async () => {
    const results = run(
      [cell("index.html", "a", "serious")],
      { findings: [entry({ pages: ["index.html"] })] },
    );
    assertEquals(onlyFinding(results).baselined, true);
  },
);

unitTest(
  "reconcile - a less severe finding than accepted stays accepted",
  // deno-lint-ignore require-await
  async () => {
    // Only escalation re-alerts. A defect that got milder is still the defect
    // that was reviewed.
    const results = run(
      [cell("index.html", "a", "minor")],
      { findings: [entry({ impact: "serious" })] },
    );
    assertEquals(onlyFinding(results).baselined, true);
  },
);

unitTest(
  "reconcile - no entry means the finding is new",
  // deno-lint-ignore require-await
  async () => {
    const results = run([cell("index.html", "a", "serious")], { findings: [] });
    const finding = onlyFinding(results);
    assertEquals(finding.baselined, false);
    assertEquals(finding.baselineNote, null);
  },
);

// ---------------------------------------------------------------------------
// Re-alerting — the cases that must not silently pass
// ---------------------------------------------------------------------------

unitTest(
  "reconcile - one unlisted page re-alerts the whole finding",
  // deno-lint-ignore require-await
  async () => {
    // Fail-closed at finding level. Accepting `index.html` must not extend to
    // `about.html`, and because a finding aggregates its pages, the known
    // occurrences re-alert with the unknown one. Noisy, never hiding.
    const results = run(
      [cell("index.html", "a", "serious"), cell("about.html", "a", "serious")],
      { findings: [entry({ pages: ["index.html"] })] },
    );
    const finding = onlyFinding(results);
    assertEquals(finding.baselined, false);
    assertEquals(finding.pages, ["about.html", "index.html"]);
    // The note still comes through, so the reader can see there *was* an
    // acceptance and why it no longer holds.
    assertEquals(finding.baselineNote, "accepted for test");
  },
);

unitTest(
  "reconcile - escalation past the accepted impact re-alerts",
  // deno-lint-ignore require-await
  async () => {
    // Accepted at minor, now critical: a regression must not inherit an old
    // acceptance.
    const results = run(
      [cell("index.html", "a", "critical")],
      { findings: [entry({ impact: "minor" })] },
    );
    const finding = onlyFinding(results);
    assertEquals(finding.baselined, false);
    assertEquals(finding.impact, "critical");
    assertEquals(results.counts.new, 1);
  },
);

unitTest(
  "reconcile - escalation re-alerts even for a site-wide acceptance",
  // deno-lint-ignore require-await
  async () => {
    const results = run(
      [cell("index.html", "a", "serious")],
      { findings: [entry({ pages: [], impact: "minor" })] },
    );
    assertEquals(onlyFinding(results).baselined, false);
  },
);

unitTest(
  "reconcile - a signature that doesn't match is not an acceptance",
  // deno-lint-ignore require-await
  async () => {
    // The signature is the join key; a near-miss must match nothing rather
    // than approximately.
    const results = run(
      [cell("index.html", "a", "serious")],
      { findings: [entry({ signature: "link-name :: p > a" })] },
    );
    assertEquals(onlyFinding(results).baselined, false);
  },
);

// ---------------------------------------------------------------------------
// Stale entries
// ---------------------------------------------------------------------------

unitTest(
  "reconcile - a site-wide entry matching nothing is reported stale",
  // deno-lint-ignore require-await
  async () => {
    const results = run(
      [cell("index.html", "a", "serious")],
      {
        findings: [
          entry(),
          entry({ signature: "region :: nav.gone", note: "long fixed" }),
        ],
      },
    );
    assertEquals(results.baseline.stale.length, 1);
    assertEquals(results.baseline.stale[0].signature, "region :: nav.gone");
    assertEquals(results.baseline.stale[0].note, "long fixed");
  },
);

unitTest(
  "reconcile - a page-scoped entry is stale when its pages are clean",
  // deno-lint-ignore require-await
  async () => {
    // The signature still occurs, but not on the page this entry accepted, so
    // the entry itself has nothing left to do.
    const results = run(
      [cell("index.html", "a", "serious")],
      { findings: [entry({ pages: ["retired.html"] })] },
    );
    assertEquals(results.baseline.stale.length, 1);
    assertEquals(results.baseline.stale[0].pages, ["retired.html"]);
  },
);

unitTest(
  "reconcile - a page-scoped entry is not stale while one listed page still fails",
  // deno-lint-ignore require-await
  async () => {
    const results = run(
      [cell("index.html", "a", "serious"), cell("about.html", "a", "serious")],
      { findings: [entry({ pages: ["index.html", "retired.html"] })] },
    );
    assertEquals(results.baseline.stale.length, 0);
  },
);

unitTest(
  "reconcile - stale entries are reported, never removed",
  // deno-lint-ignore require-await
  async () => {
    // "Resolved" is only confirmable on a full-site scan; on a subset scan a
    // stale-looking entry may live on a page that wasn't visited.
    const baseline = {
      findings: [entry({ signature: "region :: nav.gone", note: "keep me" })],
    };
    const results = run([cell("index.html", "a", "serious")], baseline);
    assertEquals(results.baseline.entries, 1);
    assertEquals(results.baseline.stale.length, 1);
    // the caller's ledger is untouched
    assertEquals(baseline.findings.length, 1);
  },
);

// ---------------------------------------------------------------------------
// Bookkeeping
// ---------------------------------------------------------------------------

unitTest(
  "reconcile - counts split new from known",
  // deno-lint-ignore require-await
  async () => {
    const cells = [
      cell("index.html", "a", "serious"),
      cell("index.html", "p > a", "serious"),
    ];
    const results = run(cells, { findings: [entry()] });
    assertEquals(results.counts.total, 2);
    assertEquals(results.counts.baselined, 1);
    assertEquals(results.counts.new, 1);
  },
);

unitTest(
  "reconcile - the baseline file path and entry count are echoed",
  // deno-lint-ignore require-await
  async () => {
    const results = run(
      [cell("index.html", "a", "serious")],
      { findings: [entry(), entry({ signature: "region :: nav.gone" })] },
    );
    assertEquals(results.baseline.file, "_axe-baseline.json");
    assertEquals(results.baseline.entries, 2);
  },
);

unitTest(
  "reconcile - duplicate entries for one signature merge their scope",
  // deno-lint-ignore require-await
  async () => {
    // One entry per signature is the intended shape, but two must not silently
    // pick a winner: the scopes union, so the acceptance covers both pages.
    // (The command warns about this; the merge is defined, not preferred.)
    const results = run(
      [cell("index.html", "a", "serious"), cell("about.html", "a", "serious")],
      {
        findings: [
          entry({ pages: ["index.html"], note: "first" }),
          entry({ pages: ["about.html"], note: "second" }),
        ],
      },
    );
    const finding = onlyFinding(results);
    assertEquals(finding.baselined, true);
    assert(finding.baselineNote!.includes("first"), finding.baselineNote!);
    assert(finding.baselineNote!.includes("second"), finding.baselineNote!);
  },
);
