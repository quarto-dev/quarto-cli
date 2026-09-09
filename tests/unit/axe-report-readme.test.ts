/*
 * axe-report-readme.test.ts
 *
 * The two rendered artifacts of `quarto call axe`: report.md (report.ts)
 * and the generated _axe-checks/README.md (readme.ts). Both are dumb views
 * over findings.json, so these tests aggregate the captured per-cell fixtures
 * (tests/docs/axe-scan/cells) exactly as the aggregate tests do, then assert
 * on projections of the rendered markdown — never a golden file.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { docs } from "../utils.ts";
import { aggregate } from "../../src/command/call/axe/aggregate.ts";
import { renderReport } from "../../src/command/call/axe/report.ts";
import {
  renderReadme,
  scanCommand,
} from "../../src/command/call/axe/readme.ts";
import { AxeScanConfig } from "../../src/command/call/axe/config.ts";
import { AxeCell } from "../../src/command/call/axe/scan.ts";
import {
  AxeBaseline,
  kFindingsVersion,
  kSignatureScheme,
} from "../../src/command/call/axe/schemas.ts";

const kCells = [
  "about__1440x900__light",
  "index__1440x900__light",
  "index__1440x900__dark",
];

function capturedCells(): AxeCell[] {
  return kCells.map((name) =>
    JSON.parse(
      Deno.readTextFileSync(
        join(docs("axe-scan/cells/findings"), `${name}.json`),
      ),
    ) as AxeCell
  );
}

const kConfig: AxeScanConfig = {
  siteDir: "_site",
  viewports: [{ width: 1440, height: 900, label: "1440x900" }],
  themes: ["light", "dark"],
  timeout: 30000,
  settle: 50,
};

// kConfig scans one viewport, which is already narrower than the default
// matrix. Claims that depend on the scan having looked everywhere need the
// full default set.
const kFullMatrix: Partial<AxeScanConfig> = {
  viewports: [
    { width: 1440, height: 900, label: "1440x900" },
    { width: 320, height: 568, label: "320x568" },
  ],
  themes: ["light", "dark"],
};

function results(overrides: {
  config?: Partial<AxeScanConfig>;
  baseline?: AxeBaseline;
  cells?: AxeCell[];
}) {
  const cells = overrides.cells ?? capturedCells();
  const pages = [...new Set(cells.map((cell) => cell.page))].sort();
  return aggregate({
    cells,
    config: { ...kConfig, ...overrides.config },
    baseline: overrides.baseline ?? { findings: [] },
    baselineFile: "_axe-baseline.json",
    anchor: Deno.cwd(),
    pages: pages.map((path) => ({
      path,
      modes: ["light", "dark"],
      darkColoured: false,
    })),
    redirects: [{ path: "old.html", to: "new.html" }],
  });
}

unitTest(
  "report.md - findings are reachable by id, markdown structure intact",
  // deno-lint-ignore require-await
  async () => {
    const findings = results({});
    const report = renderReport(findings);
    for (const finding of findings.findings) {
      // linked from the table, anchored by its occurrence heading
      assert(
        report.includes(`](#${finding.id})`),
        `table row for ${finding.id} is not linked`,
      );
      assert(
        report.includes(`#### ${finding.id}`),
        `no occurrence anchor for ${finding.id}`,
      );
      // the finding-level detail is stated once, not repeated per occurrence
      if (finding.detail) {
        const uniform = finding.occurrences.every((occurrence) =>
          occurrence.detail === finding.detail
        );
        if (uniform && finding.occurrences.length > 1) {
          const mentions = report.split(`**Problem:** `).length - 1;
          assert(mentions >= 1, "missing the Problem line");
        }
      }
    }
    // every table row stays one line: pipes and newlines inside selectors and
    // html excerpts must be neutralized, or GitHub renders garbage
    for (const line of report.split("\n")) {
      if (line.startsWith("|")) {
        assert(
          line.endsWith("|"),
          `table row broken by unescaped content: ${line.slice(0, 80)}`,
        );
      }
    }
    // redirect stubs are recorded, not red
    assert(report.includes("Redirect stubs"), "missing redirects section");
    assert(report.includes("old.html"), "missing the recorded stub");
    // full scan: no partial banner
    assert(!report.includes("Partial scan"), "full scan must not say partial");
  },
);

unitTest(
  "report.md - a subset scan says so, loudly",
  // deno-lint-ignore require-await
  async () => {
    const report = renderReport(
      results({ config: { pages: ["docs/**"], maxPages: 5 } }),
    );
    assert(report.includes("**Partial scan**"), "missing the partial banner");
    assert(report.includes("--pages docs/**"), "banner must name the filter");
    assert(report.includes("--max-pages 5"), "banner must name the cap");
  },
);

unitTest(
  "report.md - baselined findings are listed with their why",
  // deno-lint-ignore require-await
  async () => {
    const findings = results({
      baseline: {
        findings: [{
          signature: "image-alt :: img",
          pages: [],
          impact: "critical",
          note: "planted fixture defect, accepted for this test",
        }],
      },
    });
    const baselined = findings.findings.filter((f) => f.baselined);
    assertEquals(baselined.length, 1);
    const report = renderReport(findings);
    assert(
      report.includes("## Baselined (known, accepted)"),
      "missing the baselined section",
    );
    assert(
      report.includes("planted fixture defect"),
      "the why-accepted note must surface",
    );
  },
);

unitTest(
  "report.md - a stale entry is only called resolved when every cell completed",
  // deno-lint-ignore require-await
  async () => {
    // A signature the fixture cells never produce, accepted in the baseline:
    // it reads as stale in every scan below. What changes is whether the scan
    // is entitled to call it resolved.
    const baseline: AxeBaseline = {
      findings: [{
        signature: "region :: body",
        pages: [],
        impact: "moderate",
        note: "accepted so this scan reports it as stale",
      }],
    };

    // Only a scan that ran the whole default matrix over every page, with no
    // cell lost, is entitled to call an unseen entry resolved.
    const full = renderReport(results({ baseline, config: kFullMatrix }));
    assert(full.includes("region :: body"), "the stale entry must be listed");
    assert(
      full.includes("can be pruned"),
      "a full, complete scan should invite pruning",
    );

    // --themes light never runs a dark cell, so a dark-only finding reads as
    // unseen without anything having looked for it.
    const lightOnly = renderReport(results({
      baseline,
      config: { ...kFullMatrix, themes: ["light"] },
    }));
    assert(
      !lightOnly.includes("can be pruned"),
      "a theme-narrowed scan must not invite pruning a stale entry",
    );
    assert(
      lightOnly.includes("themes"),
      "the caveat must name the narrowed theme set",
    );

    // Same hole on the viewport axis: the default matrix carries a 320px
    // reflow width, and dropping it hides anything that only breaks there.
    const wideOnly = renderReport(results({
      baseline,
      config: { ...kFullMatrix, viewports: kConfig.viewports },
    }));
    assert(
      !wideOnly.includes("can be pruned"),
      "a viewport-narrowed scan must not invite pruning a stale entry",
    );
    assert(
      wideOnly.includes("viewports"),
      "the caveat must name the narrowed viewport set",
    );

    // Same full-site flags, but one cell failed closed. The finding could
    // still live on the page-mode that cell never scanned, so "not seen" is
    // not "resolved" and the report must not invite a prune.
    const withFailure = renderReport(results({
      baseline,
      config: kFullMatrix,
      cells: [
        ...capturedCells(),
        {
          page: "contact.html",
          viewport: "1440x900",
          theme: "light",
          url: "http://127.0.0.1/contact.html",
          status: "timeout",
          message: "cell timed out",
          elapsed: 30000,
        },
      ],
    }));
    assert(
      withFailure.includes("region :: body"),
      "the stale entry must still be listed when a cell failed",
    );
    assert(
      !withFailure.includes("can be pruned"),
      "an incomplete scan must not invite pruning a stale entry",
    );
    assert(
      withFailure.includes("1 cell did not complete"),
      "the report must say why staleness is inconclusive",
    );

    // A subset scan was already inconclusive, and stays so.
    const subset = renderReport(
      results({ baseline, config: { ...kFullMatrix, pages: ["*.html"] } }),
    );
    assert(
      !subset.includes("can be pruned"),
      "a subset scan must not invite pruning a stale entry",
    );
  },
);

unitTest(
  "report.md - a duplicated axis value doesn't count as the full matrix",
  // deno-lint-ignore require-await
  async () => {
    // A signature the fixture cells never produce, accepted in the baseline:
    // it reads as stale in every scan below.
    const baseline: AxeBaseline = {
      findings: [{
        signature: "region :: body",
        pages: [],
        impact: "moderate",
        note: "accepted so this scan reports it as stale",
      }],
    };

    // --themes light,light: two entries, but neither is "dark". A scan run
    // this way never scans a dark cell — applyThemesFilter (discover.ts)
    // drops every mode not literally named — so this is exactly as narrow as
    // --themes light. Matching the default set's *size* isn't matching its
    // *members*.
    const duplicateTheme = renderReport(results({
      baseline,
      config: { ...kFullMatrix, themes: ["light", "light"] },
    }));
    assert(
      !duplicateTheme.includes("can be pruned"),
      "a duplicated theme must not read as the full light+dark set",
    );

    // Same failure mode on viewports: two entries naming the same desktop
    // width never run the 320px reflow cell (scan.ts iterates config.viewports
    // verbatim, duplicates and all).
    const duplicateViewport = renderReport(results({
      baseline,
      config: {
        ...kFullMatrix,
        viewports: [
          { width: 1440, height: 900, label: "1440x900" },
          { width: 1440, height: 900, label: "1440x900" },
        ],
      },
    }));
    assert(
      !duplicateViewport.includes("can be pruned"),
      "a duplicated viewport must not read as the full viewport set",
    );

    // The other direction: --viewports takes arbitrary WxH values, so a scan
    // can name both defaults and a third. That covers every cell the default
    // matrix would and then some, so reading a superset as a narrowing would
    // withhold a prune the scan has earned.
    const extraViewport = renderReport(results({
      baseline,
      config: {
        ...kFullMatrix,
        viewports: [
          { width: 1440, height: 900, label: "1440x900" },
          { width: 320, height: 568, label: "320x568" },
          { width: 768, height: 1024, label: "768x1024" },
        ],
      },
    }));
    assert(
      extraViewport.includes("can be pruned"),
      "a superset of the default viewports must still be conclusive",
    );
  },
);

unitTest(
  "README - regenerate command reconstructs exactly the scan's flags",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      scanCommand(results({})),
      // non-default viewports and settle are echoed; defaults are not
      "quarto call axe _site --viewports 1440x900",
    );
    assertEquals(
      scanCommand(
        results({
          config: { pages: ["docs/**"], exclude: ["slides/**"], timeout: 5000 },
        }),
      ),
      'quarto call axe _site --pages "docs/**" --exclude "slides/**" ' +
        "--viewports 1440x900 --timeout 5000",
    );
    // --report changed where the report landed, so a rerun of the echoed
    // command has to land it there too — omitting it silently reverts the
    // destination to the artifact dir.
    assertEquals(
      scanCommand(results({ config: { report: "docs/a11y.md" } })),
      'quarto call axe _site --viewports 1440x900 --report "docs/a11y.md"',
    );
  },
);

unitTest(
  "README - carries the baseline how-to, versions, and the partial warning",
  // deno-lint-ignore require-await
  async () => {
    const readme = renderReadme(results({ config: { pages: ["docs/**"] } }));
    assert(
      readme.includes("regenerated on every scan"),
      "must declare itself generated",
    );
    assert(
      readme.includes(`signature scheme ${kSignatureScheme}`) &&
        readme.includes(`version ${kFindingsVersion}`),
      "missing the provenance versions",
    );
    assert(
      readme.includes("Accepting a finding"),
      "missing the baseline how-to",
    );
    assert(
      readme.includes(`"note"`) && readme.includes(`"pages": []`),
      "the how-to must show the entry shape inline",
    );
    assert(
      readme.includes("This was a partial scan"),
      "a subset scan's README must say so",
    );
    const full = renderReadme(results({}));
    assert(
      !full.includes("This was a partial scan"),
      "a full scan's README must not claim partiality",
    );
  },
);

unitTest(
  "report.md - code content renders as backtick spans that survive rendering",
  // deno-lint-ignore require-await
  async () => {
    // A page that *documents* fenced divs puts `:::` into its excerpts.
    // Emitted as <code> raw HTML, Pandoc parsed the inner text as markdown
    // and Quarto's fenced-div check warned on every render of the report;
    // a backtick span parses as a Code inline, which that check ignores.
    const divsPage: AxeCell = {
      page: "docs/divs.html",
      viewport: "1440x900",
      theme: "light",
      url: "http://127.0.0.1/docs/divs.html",
      status: "ok",
      elapsed: 10,
      result: {
        violations: [{
          id: "heading-order",
          impact: "moderate",
          tags: ["best-practice"],
          description: "Headings should not skip levels",
          help: "Heading levels should only increase by one",
          helpUrl: "https://dequeuniversity.com/rules/axe/4.10/heading-order",
          nodes: [{
            html:
              `<pre><code>::: {.callout-note}\nlook\n:::</code></pre>` +
              "with a `tick` and a | pipe",
            target: ['pre[class|="sourceCode"] > h6'],
            failureSummary: "Fix any of the following:\n  Heading order invalid",
          }],
        }],
        testEngine: { name: "axe-core", version: "4.10.3" },
      },
    };
    const report = renderReport(results({ cells: [divsPage] }));

    // the selector renders as a backtick span, not <code> raw HTML (the
    // excerpt itself contains literal "<pre><code>" text, so assert on the
    // markup around the content rather than on the string "<code>")
    assert(
      report.includes('`pre[class\\|="sourceCode"] > h6`'),
      "the selector must render as a backtick span with an escaped pipe",
    );
    // the excerpt's ::: lives inside a backtick span (one line, one cell)
    const row = report.split("\n").find((line) =>
      line.includes("::: {.callout-note}")
    );
    assert(row, "the excerpt row went missing");
    assert(
      /`[^`]*::: \{\.callout-note\}/.test(row!),
      `::: must sit inside a code span: ${row}`,
    );
    // pipes inside table code spans escape as \| so the row stays intact
    assert(row!.includes("\\|"), `pipes must be escaped in table cells: ${row}`);
    const columns = row!.split(/(?<!\\)\|/).length - 2;
    assertEquals(columns, 4, `occurrence row must keep 4 cells: ${row}`);
    // content containing backticks gets a longer, padded fence
    assert(
      row!.includes("`` "),
      `a backticked excerpt needs a widened fence: ${row}`,
    );
  },
);
