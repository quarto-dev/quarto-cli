/*
 * report.ts
 *
 * The report stage: `findings.json` in, a GitHub-flavored `report.md` out.
 *
 * A dumb view — grouping, labelling and baseline reconciliation all live in
 * aggregate.ts; the only computation here is partitioning findings on the
 * `baselined` flag aggregate already set. Markdown rather than HTML (decision
 * 2026-08-25): it renders on GitHub, drops into a site, and is accessible by
 * construction — the rich drill-down report belongs to a future Quarto
 * extension, not to CLI code. The per-finding AI briefing is gone with it;
 * the generated `_axe-checks/README.md` (readme.ts) is the agent enabler.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { AxeFinding, AxeFindings } from "./schemas.ts";

/**
 * Make arbitrary prose safe inside a markdown table cell or `<summary>`:
 * HTML-escape, then neutralize the two characters that break table
 * structure — pipes and newlines. Code-like content (selectors, HTML
 * excerpts) goes through `code`/`codeCell` instead.
 */
function cell(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "&#124;")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A markdown code span — backticks, not `<code>` raw HTML, on purpose:
 * Pandoc parses the text between `<code>` tags as markdown, so an excerpt
 * from a page that *documents* fenced divs put literal `:::` strings into
 * the AST and Quarto's fenced-div check (astpipeline.lua) warned on every
 * render of the report. A backtick span parses as a Code inline, which that
 * check ignores. The fence grows past any backtick run in the content, and
 * a space pads content that starts or ends with a backtick.
 */
function code(value: unknown): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  const runs = text.match(/`+/g) ?? [];
  const fence = "`".repeat(
    Math.max(0, ...runs.map((run) => run.length)) + 1,
  );
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

/**
 * A code span safe inside a pipe-table cell: `\|` is the one pipe escape
 * both GitHub and Pandoc honor at the cell boundary even inside a code
 * span. (GitHub strips the backslash; Pandoc renders it — a cosmetic wart
 * on the rare selector that carries a pipe, never a broken row.)
 */
function codeCell(value: unknown): string {
  return code(String(value ?? "").replace(/\|/g, "\\|"));
}

function plural(count: number, singular = "", many = "s"): string {
  return count === 1 ? singular : many;
}

// No `rule` column: the id is `<rule>-<hash>`, so a rule column would spend
// table width repeating the id's prefix — width the id link badly needs
// (markdown tables have no width control, and long-prose columns squeeze the
// wrappable id column to a sliver).
function findingsTable(findings: AxeFinding[], showWhy: boolean): string[] {
  const head = showWhy
    ? "| id | standard | impact | pages | instances | why accepted |"
    : "| id | standard | impact | pages | instances | detail |";
  const separator = "|---|---|---|---:|---:|---|";
  const rows = findings.map((finding) => {
    const last = showWhy
      ? cell(finding.baselineNote ?? "")
      : cell(finding.detail || finding.examples[0] || "");
    // New findings link to their occurrence section (a `#### <id>` heading,
    // so GitHub and Pandoc both auto-anchor it); baselined findings have no
    // occurrence sections to link to.
    const id = showWhy
      ? codeCell(finding.id)
      : `[${codeCell(finding.id)}](#${finding.id})`;
    return `| ${id} | ${cell(finding.standard)} | ` +
      `${cell(finding.impact)} | ${finding.pages.length} | ` +
      `${finding.instances} | ${last} |`;
  });
  return [head, separator, ...rows];
}

function occurrenceDetails(finding: AxeFinding): string[] {
  const summary = `${cell(finding.help)} ` +
    `(${finding.instances} instance${plural(finding.instances)} on ` +
    `${finding.pages.length} page${plural(finding.pages.length)})`;
  // The heading is what the findings table links to: GitHub and Pandoc both
  // auto-anchor headings, and the plain id slugs to itself.
  const lines = [
    `#### ${finding.id}`,
    ``,
    `<details>`,
    `<summary>${summary}</summary>`,
    ``,
    `**Standard:** ${cell(finding.conformance || "—")} · ` +
    `**Impact:** ${cell(finding.impact)} · ` +
    `**Signature:** ${code(finding.signature)}`,
    ``,
  ];
  if (finding.detail) {
    lines.push(`**Problem:** ${cell(finding.detail)}`, ``);
  }
  if (finding.helpUrl) {
    lines.push(`Reference: <${finding.helpUrl}>`, ``);
  }
  // No per-occurrence detail column: measured across full-site scans it is
  // almost always identical to the finding-level Problem line above, and the
  // rare divergent values remain in findings.json.
  lines.push(
    `| page | cells (width·mode) | selector | element |`,
    `|---|---|---|---|`,
    ...finding.occurrences.map((occurrence) =>
      `| ${cell(occurrence.page)} | ${cell(occurrence.cells.join(", "))} | ` +
      `${codeCell(occurrence.target)} | ${codeCell(occurrence.html)} |`
    ),
    ``,
    `</details>`,
    ``,
  );
  return lines;
}

/** Render `findings.json` as a GitHub-flavored `report.md`. */
export function renderReport(results: AxeFindings): string {
  const newFindings = results.findings.filter((finding) => !finding.baselined);
  const baselined = results.findings.filter((finding) => finding.baselined);
  const lines: string[] = [];

  lines.push(`# axe site audit`, ``);
  lines.push(
    `${results.pagesScanned} page${plural(results.pagesScanned)} · ` +
      `${results.cells.ok}/${results.cells.total} cells ok · ` +
      `axe-core ${results.axeVersion ?? "unknown"} · ` +
      `Quarto ${results.quartoVersion} · generated ${results.generated}`,
    ``,
  );

  // Scope must be legible: a subset snapshot must not read as site health.
  const filters: string[] = [];
  if (results.config.pages) {
    filters.push(`\`--pages ${results.config.pages.join(",")}\``);
  }
  if (results.config.exclude) {
    filters.push(`\`--exclude ${results.config.exclude.join(",")}\``);
  }
  if (results.config.maxPages !== null) {
    filters.push(`\`--max-pages ${results.config.maxPages}\``);
  }
  if (filters.length) {
    lines.push(
      `> **Partial scan** (${filters.join(", ")}) — counts describe this ` +
        `subset, not the whole site. A one-page rescan proves an instance ` +
        `is gone, not that the finding is fixed on other pages.`,
      ``,
    );
  }

  lines.push(
    `**${newFindings.length} new finding${plural(newFindings.length)}**` +
      (baselined.length
        ? ` · ${baselined.length} baselined (known, listed at the end)`
        : "") +
      `. A finding on many pages usually repeats from a shared source — ` +
      `fixing it once fixes them all. To accept a finding, see ` +
      `\`README.md\` in this directory.`,
    ``,
  );

  if (results.notOkCells.length) {
    lines.push(
      `## ⚠ Cells that did not complete (fail-closed — never counted as passing)`,
      ``,
      `| page | viewport | mode | status | detail |`,
      `|---|---|---|---|---|`,
      ...results.notOkCells.map((notOk) =>
        `| ${cell(notOk.page)} | ${cell(notOk.viewport)} | ` +
        `${cell(notOk.theme)} | ${cell(notOk.status)} | ` +
        `${cell(notOk.message ?? "")} |`
      ),
      ``,
    );
  }

  if (results.baseline.stale.length) {
    lines.push(
      `> ${results.baseline.stale.length} baseline entr` +
        `${results.baseline.stale.length === 1 ? "y" : "ies"} not seen in ` +
        `this scan — if this was a full-site scan they are resolved and can ` +
        `be pruned by hand: ` +
        results.baseline.stale.map((entry) =>
          `\`${entry.id ?? entry.signature}\``
        ).join(", "),
      ``,
    );
  }

  lines.push(`## New findings`, ``);
  if (newFindings.length) {
    lines.push(...findingsTable(newFindings, false), ``);
    lines.push(`### Occurrences`, ``);
    for (const finding of newFindings) {
      lines.push(...occurrenceDetails(finding));
    }
  } else {
    lines.push(`(none)`, ``);
  }

  if (baselined.length) {
    lines.push(
      `## Baselined (known, accepted)`,
      ``,
      ...findingsTable(baselined, true),
      ``,
    );
  }

  if (results.redirects?.length) {
    lines.push(
      `## Redirect stubs (skipped, not content)`,
      ``,
      ...results.redirects.map((stub) =>
        `- ${code(stub.output)} → ${code(stub.to ?? "?")}`
      ),
      ``,
    );
  }

  lines.push(
    `---`,
    ``,
    `Full machine-readable results: \`findings.json\` (schema documented ` +
      `in \`README.md\` alongside this report).`,
    ``,
  );
  return lines.join("\n");
}
