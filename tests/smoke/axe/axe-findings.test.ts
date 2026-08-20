/*
 * axe-findings.test.ts
 *
 * `quarto dev-call axe` against tests/docs/axe-scan/sites/findings: grouping,
 * the systemic/localized call, the impact spread, baseline reconciliation and
 * the report.
 *
 * The matrix axes live in axe-matrix.test.ts and light-only brand reuse in
 * axe-brand.test.ts, each against its own site, so a page added here cannot
 * move an assertion there.
 *
 * Assertions are projections, never a golden payload: findings are looked up by
 * signature and checked for the properties the fixture plants on purpose. The
 * site also produces findings from Quarto's own navbar, which belong to Quarto
 * and may change on upgrade, so nothing depends on the total count.
 *
 * Chrome is available on CI: test-smokes.yml runs
 * `quarto install chrome-headless-shell --no-prompt` unconditionally, and
 * getBrowserExecutablePath() finds it.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals } from "testing/asserts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { ExecuteOutput, Verify } from "../../test.ts";
import {
  axeSmokeTest,
  find,
  kReportFile,
  readCell,
  readFindings,
} from "./shared.ts";

const plantedFindings: Verify = {
  name: "the planted violations are found, grouped as intended",
  verify: (_output: ExecuteOutput[]) => {
    const { findings } = readFindings();

    // critical, and systemic because it comes from a shared include. The page
    // list is checked for the pages that plant it, not for equality: another
    // page including _systemic.qmd is a fixture addition, not a regression.
    const systemic = find(findings, "image-alt :: img");
    assertEquals(systemic.impact, "critical");
    assertEquals(systemic.label, "systemic");
    for (const page of ["about.html", "index.html"]) {
      assert(
        systemic.pages.includes(page),
        `${page} missing from ${JSON.stringify(systemic.pages)}`,
      );
    }

    // serious, and localized because it is planted on one page. Equality is
    // right here: a second page carrying it would make it systemic, and that
    // should fail.
    const localized = find(findings, "link-name :: p > a");
    assertEquals(localized.impact, "serious");
    assertEquals(localized.label, "localized");
    assertEquals(localized.pages, ["index.html"]);

    // moderate, completing the impact spread
    const heading = find(findings, "heading-order :: h4");
    assertEquals(heading.impact, "moderate");
    assertEquals(heading.label, "localized");
    assertEquals(heading.pages, ["index.html"]);

    return Promise.resolve();
  },
};

const nonQuartoPageScans: Verify = {
  name: "a page Quarto did not render scans, and its dark cells reuse",
  verify: (_output: ExecuteOutput[]) => {
    // static/legacy.html is hand-written and copied through as a resource, the
    // shape a real Quarto site reaches for when it ships a page Pandoc never
    // touched. Nothing in the scanner may require Quarto's DOM: this page has
    // no colour-scheme links and no toggle, so the dark cells must reuse the
    // light payload rather than wait for a control that will never appear.
    //
    // The signature-normalization edge cases this page also carries are pinned
    // browser-free, in unit/axe-signature.test.ts and unit/axe-aggregate.test.ts.
    const results = readFindings();
    assert(
      results.pages.some((page) => page.output === "static/legacy.html"),
      `legacy.html was not scanned: ${
        JSON.stringify(results.pages.map((p) => p.output))
      }`,
    );

    const light = readCell("static_legacy__1440x900__light");
    const dark = readCell("static_legacy__1440x900__dark");
    assertEquals(light.colorScheme, "emulated");
    assertEquals(dark.colorScheme, "assumed-identical");
    // the reused payload is the light one, not an empty result
    assert(
      light.result!.violations.length > 0,
      "the light cell found nothing, so reuse proves nothing",
    );
    assertEquals(
      dark.result!.violations.length,
      light.result!.violations.length,
    );

    // and reuse is a decision about this page, not the scanner giving up: a
    // Quarto page on the same site did reach its theme through the toggle.
    assertEquals(readCell("index__1440x900__dark").colorScheme, "toggled");

    return Promise.resolve();
  },
};

const baselineReconciled: Verify = {
  name: "the committed baseline accepts, re-alerts and reports stale",
  verify: (_output: ExecuteOutput[]) => {
    const results = readFindings();

    // accepted site-wide
    assertEquals(find(results.findings, "image-alt :: img").baselined, true);
    // accepted for the one page it occurs on
    assertEquals(find(results.findings, "link-name :: p > a").baselined, true);
    // the exclude-in-source stand-in, accepted page-scoped
    assertEquals(
      find(results.findings, 'image-alt :: img[width="*"]').baselined,
      true,
    );

    // accepted at minor while planted moderate, so escalation re-alerts
    const escalated = find(results.findings, "heading-order :: h4");
    assertEquals(escalated.baselined, false);
    assert(escalated.baselineNote, "the note should survive the re-alert");

    // three entries accept. This count is the committed ledger's own size, not
    // the site's: adding a page cannot change it.
    assertEquals(results.counts.baselined, 3);

    // one entry matches nothing and is reported rather than removed
    assertEquals(results.baseline.stale.length, 1);
    assertEquals(results.baseline.stale[0].id, "region-fixture0");

    return Promise.resolve();
  },
};

const reportIsUsable: Verify = {
  name: "report.html carries the findings and their briefings",
  verify: (_output: ExecuteOutput[]) => {
    const html = Deno.readTextFileSync(kReportFile);
    const { findings } = readFindings();
    // Every finding is reachable in the report, and its AI briefing payload is
    // embedded rather than looked up at view time.
    for (const finding of findings) {
      assert(
        html.includes(finding.id),
        `report.html is missing finding ${finding.id}`,
      );
    }
    assert(html.includes('id="axe-ai"'), "missing the briefing payload block");
    assert(html.includes("Known / baselined"), "missing the baselined section");
    return Promise.resolve();
  },
};

const rawCellsKept: Verify = {
  name: "raw per-cell payloads are kept for re-aggregation",
  verify: (_output: ExecuteOutput[]) => {
    // v1 always keeps these: re-grouping under a different signature scheme
    // must never require a re-scan.
    for (
      const cell of [
        "_axe-checks/cells/index__1440x900__light.json",
        "_axe-checks/cells/about__390x844__dark.json",
        "_axe-checks/cells/static_legacy__1440x900__light.json",
      ]
    ) {
      assert(existsSync(cell), `missing ${cell}`);
    }
    return Promise.resolve();
  },
};

axeSmokeTest(
  "findings",
  "quarto dev-call axe (findings: grouping, baseline, report)",
  [
    plantedFindings,
    nonQuartoPageScans,
    baselineReconciled,
    reportIsUsable,
    rawCellsKept,
  ],
);
