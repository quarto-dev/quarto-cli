/*
 * axe-scan.test.ts
 *
 * End-to-end smoke test for `quarto dev-call axe`: renders the fixture site,
 * scans it with real headless Chrome, and checks the artifacts.
 *
 * This is the only test that exercises the browser, the static server and the
 * three stages together. Everything cheaper — signature normalization, the
 * aggregate stage, baseline reconciliation, the baseline reader — is covered
 * browser-free in tests/unit/axe-*.test.ts.
 *
 * Assertions are projections, never a golden payload: findings are looked up by
 * signature and checked for the properties the fixture plants on purpose. The
 * fixture also produces findings from Quarto's own navbar, which belong to
 * Quarto and may change on upgrade, so no assertion depends on the total count.
 *
 * Chrome is available on CI: test-smokes.yml runs
 * `quarto install chrome-headless-shell --no-prompt` unconditionally, and
 * getBrowserExecutablePath() finds it.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals } from "testing/asserts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { ExecuteOutput, testQuartoCmd, Verify } from "../../test.ts";
import { fileExists, validJsonWithFields } from "../../verify.ts";
import { docs } from "../../utils.ts";
import { quarto } from "../../../src/quarto.ts";
import {
  AxeFinding,
  axeFindingsSchema,
  kFindingsVersion,
  kSignatureScheme,
} from "../../../src/command/dev-call/axe/schemas.ts";

const kSite = docs("axe-scan/site");
const kFindingsFile = "_axe-checks/findings.json";
const kReportFile = "_axe-checks/report.html";

function readFindings() {
  const parsed = axeFindingsSchema.safeParse(
    JSON.parse(Deno.readTextFileSync(kFindingsFile)),
  );
  assert(
    parsed.success,
    "findings.json does not satisfy its own schema: " +
      (parsed.success ? "" : JSON.stringify(parsed.error.issues, null, 2)),
  );
  return parsed.data;
}

function find(findings: AxeFinding[], signature: string): AxeFinding {
  const finding = findings.find((f) => f.signature === signature);
  assert(
    finding,
    `no finding with signature '${signature}'. Present:\n  ` +
      findings.map((f) => f.signature).join("\n  "),
  );
  return finding!;
}

/** Every cell produced an axe payload — fail-closed means this is the gate. */
const allCellsOk: Verify = {
  name: "every cell completed",
  verify: (_output: ExecuteOutput[]) => {
    const results = readFindings();
    assertEquals(
      results.cells.notOk,
      0,
      `not-ok cells: ${JSON.stringify(results.notOkCells)}`,
    );
    assertEquals(results.cells.total, results.cells.ok);
    // 7 pages x 2 viewports x 2 themes
    assertEquals(results.cells.total, 28);
    assertEquals(results.pagesScanned, 7);
    return Promise.resolve();
  },
};

const plantedFindings: Verify = {
  name: "the planted violations are found, grouped as intended",
  verify: (_output: ExecuteOutput[]) => {
    const { findings } = readFindings();

    // critical, and systemic because it comes from a shared include
    const systemic = find(findings, "image-alt :: img");
    assertEquals(systemic.impact, "critical");
    assertEquals(systemic.label, "systemic");
    assertEquals(systemic.pages, [
      "about.html",
      "index.html",
      "media.html",
      "theme.html",
    ]);

    // serious, and localized because it is planted on one page
    const localized = find(findings, "link-name :: p > a");
    assertEquals(localized.impact, "serious");
    assertEquals(localized.label, "localized");
    assertEquals(localized.pages, ["index.html"]);

    // moderate, completing the impact spread
    const heading = find(findings, "heading-order :: h4");
    assertEquals(heading.impact, "moderate");
    assertEquals(heading.pages, ["index.html"]);

    return Promise.resolve();
  },
};

const matrixEarnsItsCost: Verify = {
  name: "the theme and viewport axes each find something the other cannot",
  verify: (_output: ExecuteOutput[]) => {
    const { findings } = readFindings();

    // reached by emulating prefers-color-scheme: author CSS media query
    const darkOnly = find(findings, "color-contrast :: #555555 on #333333");
    assertEquals(darkOnly.themes, ["dark"]);
    assertEquals(darkOnly.viewports, ["1440x900", "390x844"]);

    const mobileOnly = find(findings, "color-contrast :: #f8f8f8 on #f0f0f0");
    assertEquals(mobileOnly.viewports, ["390x844"]);
    assertEquals(mobileOnly.themes, ["dark", "light"]);

    return Promise.resolve();
  },
};

const quartoDarkThemeIsReached: Verify = {
  name: "the Quarto dark theme is selected, not just emulated",
  verify: (_output: ExecuteOutput[]) => {
    // This failure lives in darkly's own palette, so it is unreachable by
    // prefers-color-scheme emulation: the fixture leaves
    // respect-user-color-scheme at its default of false. Only driving Quarto's
    // colour-scheme toggle selects the theme, which is why this assertion is
    // the one that would fail if the toggle handling regressed.
    const { findings } = readFindings();
    const themeOnly = find(findings, "color-contrast :: #6c757d on #222222");
    assertEquals(themeOnly.themes, ["dark"]);
    assertEquals(themeOnly.pages, ["theme.html"]);
    assertEquals(themeOnly.impact, "serious");
    return Promise.resolve();
  },
};

const reuseNeedsADarkBuild: Verify = {
  name: "light-only colour-scheme links do not count as a dark theme",
  verify: (_output: ExecuteOutput[]) => {
    // static/brand-light-only.html carries data-mode="light" links and no dark
    // build, the shape a light-only _brand.yml produces. A probe matching
    // [data-mode] rather than [data-mode="dark"] reads that as "there is a dark
    // theme" and scans both themes for nothing — the bug this pins.
    const read = (theme: string) =>
      JSON.parse(
        Deno.readTextFileSync(
          `_axe-checks/cells/static_brand-light-only__1440x900__${theme}.json`,
        ),
      );
    assertEquals(read("light").colorScheme, "emulated");
    assertEquals(read("dark").colorScheme, "assumed-identical");
    // and the reused payload is the light one, not an empty result
    assertEquals(
      read("dark").result.violations.length,
      read("light").result.violations.length,
    );
    return Promise.resolve();
  },
};

const colorSchemeRoutesRecorded: Verify = {
  name: "each cell records how it reached its theme, and none is unreachable",
  verify: (_output: ExecuteOutput[]) => {
    const dir = "_axe-checks/cells";
    let toggled = 0;
    let unreachable = 0;
    for (const entry of Deno.readDirSync(dir)) {
      if (!entry.name.endsWith(".json")) {
        continue;
      }
      const cell = JSON.parse(Deno.readTextFileSync(`${dir}/${entry.name}`));
      if (cell.colorScheme === "toggled") {
        toggled++;
      }
      if (cell.colorScheme === "unreachable") {
        unreachable++;
      }
    }
    // Every Quarto page in this fixture renders the toggle, so no cell should
    // have failed to reach its theme.
    assertEquals(unreachable, 0, "some cells could not select their theme");
    // And the toggle must actually have been used: if this is 0, the scanner
    // fell back to emulation everywhere and the dark cells are light ones.
    assert(toggled > 0, "the colour-scheme toggle was never driven");
    return Promise.resolve();
  },
};

const signaturesDiscriminate: Verify = {
  name: "two components on one generic attribute stay separate",
  verify: (_output: ExecuteOutput[]) => {
    const { findings } = readFindings();
    // Digit runs inside the value are wildcarded, so the three panels collapse.
    const panels = find(
      findings,
      'button-name :: button[data-widget-target="#panel-*"]',
    );
    assertEquals(panels.instances, 3);
    assertEquals(panels.label, "systemic");
    // The dialog shares the attribute but not the value: accepting the panels
    // must not silence it.
    const dialog = find(
      findings,
      'button-name :: button[data-widget-target="#settings-dialog"]',
    );
    assertEquals(dialog.instances, 1);
    assert(panels.id !== dialog.id);
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
    assertEquals(
      find(results.findings, "link-name :: p > a").baselined,
      true,
    );
    // accepted at minor while planted serious, so escalation re-alerts
    const escalated = find(
      results.findings,
      "color-contrast :: #555555 on #333333",
    );
    assertEquals(escalated.baselined, false);
    assert(escalated.baselineNote, "the note should survive the re-alert");

    // three entries accept; the count is stable because it depends only on the
    // committed ledger and the planted findings, not on Quarto's chrome
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
        "_axe-checks/cells/media__390x844__dark.json",
        "_axe-checks/cells/static_legacy__1440x900__light.json",
      ]
    ) {
      assert(existsSync(cell), `missing ${cell}`);
    }
    return Promise.resolve();
  },
};

testQuartoCmd(
  "dev-call",
  ["axe", "_site"],
  [
    fileExists(kFindingsFile),
    fileExists(kReportFile),
    validJsonWithFields(kFindingsFile, {
      version: kFindingsVersion,
      signatureScheme: kSignatureScheme,
    }),
    allCellsOk,
    plantedFindings,
    matrixEarnsItsCost,
    quartoDarkThemeIsReached,
    reuseNeedsADarkBuild,
    colorSchemeRoutesRecorded,
    signaturesDiscriminate,
    baselineReconciled,
    reportIsUsable,
    rawCellsKept,
  ],
  {
    cwd: () => kSite,
    setup: async () => {
      // The fixture is source only: a committed render would carry site_libs/
      // and go stale on every Quarto change.
      await quarto(["render"]);
    },
    teardown: async () => {
      for (const dir of ["_site", "_axe-checks"]) {
        if (existsSync(dir)) {
          Deno.removeSync(dir, { recursive: true });
        }
      }
      return await Promise.resolve();
    },
    // rendering a website plus 20 browser cells
    timeout: 900000,
  },
  "quarto dev-call axe (fixture site)",
);
