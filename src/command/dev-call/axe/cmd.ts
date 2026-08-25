/*
 * cmd.ts
 *
 * `quarto dev-call axe` — hidden prototype accessibility scanner. Serves an
 * already-rendered site, discovers each page's colour modes from its HTML,
 * drives headless Chrome over the page x viewport x mode matrix with
 * quarto-cli's vendored axe-core, and writes the raw per-cell payloads.
 * Aggregation and the HTML report come next.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { error, info } from "../../../deno_ral/log.ts";
import { ensureDirSync, existsSync } from "../../../deno_ral/fs.ts";
import { dirname, join, resolve } from "../../../deno_ral/path.ts";
import { findOpenPort } from "../../../core/port.ts";
import { httpFileRequestHandler } from "../../../core/http.ts";
import { handleHttpRequests } from "../../../core/http-server.ts";
import { projectConfigFile } from "../../../project/project-shared.ts";
import {
  AxeScanConfig,
  axeScanConfig,
  kAxeBaselineFile,
  kAxeOutputDir,
  kDefaultSettle,
  kDefaultThemes,
  kDefaultTimeout,
  kDefaultViewports,
} from "./config.ts";
import { applyThemesFilter, AxePage, discoverPages } from "./discover.ts";
import { AxeCell, launchScanBrowser, runAxeScan } from "./scan.ts";
import { aggregate } from "./aggregate.ts";
import { renderReport } from "./report.ts";
import { AxeBaseline, AxeFindings, parseBaseline } from "./schemas.ts";

/** Scan complete: every cell produced an axe payload. */
const kExitComplete = 0;
/**
 * Scan incomplete: a not-ok cell, no browser, or nothing to scan. There is
 * deliberately no exit 1 in v1 — findings never fail the command.
 */
const kExitIncomplete = 2;

function cellLine(cell: AxeCell): string {
  const name = `${cell.page} ${cell.viewport} ${cell.theme}`;
  if (cell.status !== "ok") {
    return `  ${name.padEnd(56)} ${cell.status.toUpperCase()}`;
  }
  const violations = cell.result!.violations;
  const ids = violations.map((violation) => violation.id).join(",") || "(none)";
  return `  ${name.padEnd(56)} ${
    String(violations.length).padStart(3)
  }  ${ids}`;
}

/**
 * Where `_axe-checks/` and `_axe-baseline.json` live: the nearest project root
 * at or above the site dir, else the working directory.
 *
 * The artifacts sit *beside* the output dir, never inside it — a full render of
 * a website or book deletes the output dir, and anything that survived there
 * would be published. The cheap `_quarto.yml` check agrees with a real
 * `ProjectContext.dir` wherever a project config exists; reading the project's
 * own `output-dir` is what would need `projectContext()`, and that is deferred
 * (see the design note's cut list).
 */
export function resolveAnchor(siteDir: string): string {
  let dir = resolve(siteDir);
  for (;;) {
    if (projectConfigFile(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return Deno.cwd();
    }
    dir = parent;
  }
}

/**
 * Read the hand-written ledger. Missing is fine — that's the first run. A
 * present-but-invalid ledger is an error: a misspelled field would otherwise
 * mean "no impact recorded" or "site-wide", silently.
 */
export function readBaseline(file: string): AxeBaseline {
  if (!existsSync(file)) {
    return { findings: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Deno.readTextFileSync(file));
  } catch (e) {
    throw new Error(
      `${file} is not valid JSON: ${e instanceof Error ? e.message : e}`,
    );
  }
  const result = parseBaseline(parsed);
  if (!result.success) {
    const issues = result.issues.map((issue) =>
      `  ${issue.path}: ${issue.message}`
    ).join("\n");
    throw new Error(`${file} is not a valid baseline:\n${issues}`);
  }
  return result.baseline;
}

function summaryTable(results: AxeFindings): string[] {
  if (results.findings.length === 0) {
    return ["  (no violations found)"];
  }
  const rows = results.findings.map((finding) => [
    finding.id,
    finding.impact,
    finding.standard,
    String(finding.instances),
    String(finding.pages.length),
    finding.label,
    finding.baselined ? "known" : "new",
  ]);
  const header = ["ID", "IMPACT", "STANDARD", "N", "PAGES", "SCOPE", "STATUS"];
  const widths = header.map((cell, column) =>
    Math.max(cell.length, ...rows.map((row) => row[column].length))
  );
  const line = (cells: string[]) =>
    "  " +
    cells.map((cell, column) => cell.padEnd(widths[column])).join("  ")
      .trimEnd();
  return [line(header), ...rows.map(line)];
}

/**
 * Run the scan stage against `config.siteDir` and return the process exit code.
 */
export async function axeScan(config: AxeScanConfig): Promise<number> {
  if (!existsSync(config.siteDir)) {
    error(`Site directory not found: ${config.siteDir}`);
    return kExitIncomplete;
  }
  if (!Deno.statSync(config.siteDir).isDirectory) {
    error(`Not a directory: ${config.siteDir}`);
    return kExitIncomplete;
  }

  let pages: AxePage[];
  try {
    pages = discoverPages(config);
    if (pages.length === 0) {
      error(
        config.pages || config.exclude
          ? `No pages in ${config.siteDir} survived --pages/--exclude.`
          : `No *.html pages found in ${config.siteDir}.`,
      );
      return kExitIncomplete;
    }
    pages = applyThemesFilter(pages, config.themes);
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
    return kExitIncomplete;
  }

  const anchor = resolveAnchor(config.siteDir);
  const outputDir = join(anchor, kAxeOutputDir);
  const cellsDir = join(outputDir, "cells");
  const baselineFile = join(anchor, kAxeBaselineFile);
  ensureDirSync(cellsDir);

  let baseline: AxeBaseline;
  try {
    baseline = readBaseline(baselineFile);
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
    return kExitIncomplete;
  }

  // Serve the site dir first, so the bound port can't be handed to Chrome next.
  const sitePort = findOpenPort();
  const server = handleHttpRequests({
    port: sitePort,
    hostname: "127.0.0.1",
    handler: httpFileRequestHandler({
      baseDir: config.siteDir,
      defaultFile: "index.html",
    }),
    // the scan's own progress output is the interesting part
    onListen: () => {},
  });
  const baseUrl = `http://127.0.0.1:${sitePort}`;

  // The matrix is known before the browser launches: modes were discovered
  // from each page's rendered HTML, so print what will run — not a guess.
  const modeSplit = new Map<string, number>();
  for (const page of pages) {
    const label = page.modes.join("+");
    modeSplit.set(label, (modeSplit.get(label) ?? 0) + 1);
  }
  const split = [...modeSplit.entries()]
    .map(([label, count]) => `${count} ${label}`)
    .join(", ");
  const cellCount = pages.reduce((sum, page) => sum + page.modes.length, 0) *
    config.viewports.length;
  info(
    `axe: ${pages.length} pages (${split}) × ` +
      `${config.viewports.length} viewports — ${cellCount} cells`,
  );
  const darkColoured = pages.filter((page) => page.darkColoured);
  if (darkColoured.length) {
    info(
      `note: single mode, but the theme is dark-coloured (scanned once, ` +
        `as 'default'): ${darkColoured.map((page) => page.path).join(", ")}`,
    );
  }

  let browser;
  try {
    browser = await launchScanBrowser(findOpenPort(9222));
  } catch (e) {
    error(
      `Could not start headless Chrome: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    server.stop();
    return kExitIncomplete;
  }

  try {
    const scan = await runAxeScan(
      browser.client,
      config,
      baseUrl,
      pages,
      cellsDir,
      (cell) => info(cellLine(cell)),
    );

    const notOk = scan.cells.filter((cell) => cell.status !== "ok");
    info("");
    info(
      `${scan.cells.length} cells: ${scan.cells.length - notOk.length} ok` +
        (notOk.length ? `, ${notOk.length} not ok` : ""),
    );
    if (scan.axeVersion) {
      info(
        `axe-core ${scan.axeVersion} (quarto-cli's vendored build, injected at scan time)`,
      );
    }

    const results = aggregate({
      cells: scan.cells,
      config,
      baseline,
      baselineFile,
      pages,
      axeVersion: scan.axeVersion,
    });

    const findingsFile = join(outputDir, "findings.json");
    const reportFile = join(outputDir, "report.html");
    Deno.writeTextFileSync(findingsFile, JSON.stringify(results, null, 2));
    Deno.writeTextFileSync(reportFile, renderReport(results));

    info("");
    for (const row of summaryTable(results)) {
      info(row);
    }
    info("");
    info(
      `  ${results.counts.total} finding${
        results.counts.total === 1 ? "" : "s"
      } (${results.counts.new} new, ${results.counts.baselined} known)`,
    );
    info(`  findings: ${findingsFile}`);
    info(`  report:   ${reportFile}`);
    info(`  cells:    ${cellsDir}`);
    info(
      `  baseline: ${baselineFile} (${results.baseline.entries} entr` +
        `${results.baseline.entries === 1 ? "y" : "ies"}` +
        `${existsSync(baselineFile) ? "" : ", not present"})`,
    );
    if (results.baseline.stale.length) {
      info(
        `  ${results.baseline.stale.length} baseline entr${
          results.baseline.stale.length === 1 ? "y" : "ies"
        } not seen this scan — prune by hand after a full-site scan: ${
          results.baseline.stale.map((entry) => entry.id ?? entry.signature)
            .join(", ")
        }`,
      );
    }

    if (notOk.length) {
      for (const cell of notOk) {
        error(
          `  ${cell.page} ${cell.viewport} ${cell.theme}: ${cell.status}` +
            (cell.message ? ` — ${cell.message}` : ""),
        );
      }
      return kExitIncomplete;
    }
    return kExitComplete;
  } catch (e) {
    // scanCell fails its own cell closed; this catches what it can't — the
    // shared setup (Runtime.enable), a stage bug — so the command reports
    // incomplete instead of dying on an uncaught error.
    error(`Scan aborted: ${e instanceof Error ? e.message : String(e)}`);
    return kExitIncomplete;
  } finally {
    await browser.close();
    server.stop();
  }
}

export const axeCommand = new Command()
  .name("axe")
  .hidden()
  .arguments("<site-dir:string>")
  .description(
    "Scan a rendered site for accessibility violations with axe-core.\n\n" +
      "Prototype: scans every page in <site-dir> across the viewport x mode " +
      "matrix (modes discovered per page from its HTML), groups violations " +
      "by root-cause signature, reconciles " +
      `${kAxeBaselineFile}, and writes findings.json plus report.html to ` +
      `${kAxeOutputDir}/. Both sit at the project root (the nearest ` +
      `_quarto.yml at or above <site-dir>), or the working directory if ` +
      `there is no project.`,
  )
  .option(
    "--pages <globs:string>",
    "Comma-separated site-relative globs to scan (default: all *.html).",
  )
  .option(
    "--exclude <globs:string>",
    "Comma-separated site-relative globs to skip, applied after --pages " +
      "(e.g. slides/**,archive/**).",
  )
  .option(
    "--max-pages <count:number>",
    "Cap the number of pages scanned (sorted, first n).",
  )
  .option(
    "--viewports <viewports:string>",
    "Comma-separated WxH viewports to emulate.",
    { default: kDefaultViewports },
  )
  .option(
    "--themes <themes:string>",
    "Filter a two-mode page's discovered light/dark cells (light, dark). " +
      "Pages with a single mode always scan once.",
    { default: kDefaultThemes },
  )
  .option(
    "--timeout <ms:number>",
    "Per-cell budget in milliseconds.",
    { default: kDefaultTimeout },
  )
  .option(
    "--settle <ms:number>",
    "Extra delay in milliseconds after the page reports ready (webfonts " +
      "loaded, layout painted), before axe runs.",
    { default: kDefaultSettle },
  )
  .example(
    "Scan a rendered site",
    "quarto dev-call axe _site",
  )
  .example(
    "Scan two pages, desktop light only",
    "quarto dev-call axe _site --pages index.html,about.html " +
      "--viewports 1440x900 --themes light",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, siteDir: string) => {
    const code = await axeScan(axeScanConfig(options, siteDir));
    if (code !== kExitComplete) {
      Deno.exit(code);
    }
  });
