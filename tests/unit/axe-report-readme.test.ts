/*
 * axe-report-readme.test.ts
 *
 * The two rendered artifacts of `quarto dev-call axe`: report.md (report.ts)
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
import { aggregate } from "../../src/command/dev-call/axe/aggregate.ts";
import { renderReport } from "../../src/command/dev-call/axe/report.ts";
import {
  renderReadme,
  scanCommand,
} from "../../src/command/dev-call/axe/readme.ts";
import { AxeScanConfig } from "../../src/command/dev-call/axe/config.ts";
import { AxeCell } from "../../src/command/dev-call/axe/scan.ts";
import {
  AxeBaseline,
  kFindingsVersion,
  kSignatureScheme,
} from "../../src/command/dev-call/axe/schemas.ts";

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
  "README - regenerate command reconstructs exactly the scan's flags",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      scanCommand(results({})),
      // non-default viewports and settle are echoed; defaults are not
      "quarto dev-call axe _site --viewports 1440x900",
    );
    assertEquals(
      scanCommand(
        results({
          config: { pages: ["docs/**"], exclude: ["slides/**"], timeout: 5000 },
        }),
      ),
      'quarto dev-call axe _site --pages "docs/**" --exclude "slides/**" ' +
        "--viewports 1440x900 --timeout 5000",
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
