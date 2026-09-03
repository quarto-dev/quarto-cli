/*
 * cmd.ts
 *
 * `quarto call axe` — hidden prototype accessibility scanner. Serves an
 * already-rendered site, discovers each page's colour modes from its HTML,
 * drives headless Chrome over the page x viewport x mode matrix with
 * quarto-cli's vendored axe-core, aggregates by root-cause signature, and
 * reconciles a hand-written baseline. Architecture and rationale:
 * llm-docs/axe-scan-architecture.md; usage: dev-docs/axe-scan.md.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { debug, error, info } from "../../../deno_ral/log.ts";
import { ensureDirSync, existsSync } from "../../../deno_ral/fs.ts";
import { dirname, join, resolve } from "../../../deno_ral/path.ts";
import { exitWithCleanup } from "../../../core/cleanup.ts";
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
  isAxeOptionError,
} from "./config.ts";
import {
  applyThemesFilter,
  AxePage,
  AxeRedirectStub,
  discoverPages,
} from "./discover.ts";
import { AxeCell, launchScanBrowser, runAxeScan } from "./scan.ts";
import { aggregate, failingFindings } from "./aggregate.ts";
import { renderReport } from "./report.ts";
import { renderReadme } from "./readme.ts";
import { AxeBaseline, AxeFindings, parseBaseline } from "./schemas.ts";

/**
 * Scan complete: every cell produced an axe payload — and, when `--fail-on`
 * was given, no new finding reached its threshold.
 */
const kExitComplete = 0;
/**
 * A complete scan found NEW (non-baselined) findings at or above `--fail-on`
 * — the CI regression signal. Never used unless `--fail-on` was given:
 * findings alone don't fail the command.
 */
const kExitNewFindings = 1;
/**
 * Scan incomplete: a not-ok cell, no browser, or nothing to scan. Takes
 * precedence over exit 1 — an incomplete scan never reads as a pass.
 */
const kExitIncomplete = 2;
/**
 * A flag was wrong: a bad value, or a filter that can't match anything.
 *
 * Its own code because 1 and 2 are already spoken for by results, and a typo
 * is not a result. `quarto`'s root handler exits 1 for any error it catches,
 * which is right everywhere else but collides here with "new findings at the
 * --fail-on threshold" — so option errors are caught before they reach it.
 */
const kExitUsage = 3;

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
 * (llm-docs/axe-scan-architecture.md, "Artifacts and the anchor").
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
    finding.baselined ? "known" : "new",
  ]);
  const header = ["ID", "IMPACT", "STANDARD", "N", "PAGES", "STATUS"];
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
 * Are we a project script running on a render that didn't rebuild everything?
 *
 * Scanning a partly-rebuilt site is worse than not scanning: the findings
 * describe a mixture of this render's output and the last one's. Quarto runs
 * post-render scripts on incremental renders too — the comment at
 * `src/command/render/project.ts:830` says otherwise, but the only guard there
 * is `if (!projResults.error)`.
 *
 * The signal is an inference, not a contract. `QUARTO_PROJECT_RENDER_ALL` is
 * documented as set only for a full render — unset for an incremental render
 * *or a preview*, so previews skip too, which is what you want when it reloads
 * on every keystroke. But "unset" is also true at a plain command line, so a
 * second variable has to say "I am a project script at all". Quarto exposes no
 * such flag; `QUARTO_PROJECT_OUTPUT_DIR` is the closest thing, being the one
 * variable present for both pre- and post-render scripts and absent otherwise.
 * `QUARTO_PROJECT_OUTPUT_FILES` would be the precise post-only marker, but it
 * goes missing when `QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES` is in play
 * (project.ts:842-852, for environments that cap env-var length).
 *
 * Takes its reader so tests don't have to mutate the process environment.
 */
export function isIncrementalProjectRender(
  env: (key: string) => string | undefined = (key) => Deno.env.get(key),
): boolean {
  return env("QUARTO_PROJECT_OUTPUT_DIR") !== undefined &&
    env("QUARTO_PROJECT_RENDER_ALL") === undefined;
}

/**
 * Run the scan stage against `config.siteDir` and return the process exit code.
 */
export async function axeScan(config: AxeScanConfig): Promise<number> {
  if (isIncrementalProjectRender()) {
    // Expected, and not a failure: exit 0 so an incremental render succeeds.
    info(
      "note: skipping the accessibility scan — this render rebuilt only some " +
        "of the site, so a scan would mix this render's output with the " +
        "last one's. A full `quarto render` scans.",
    );
    return kExitComplete;
  }
  if (!existsSync(config.siteDir)) {
    error(`Site directory not found: ${config.siteDir}`);
    return kExitIncomplete;
  }
  if (!Deno.statSync(config.siteDir).isDirectory) {
    error(`Not a directory: ${config.siteDir}`);
    return kExitIncomplete;
  }

  let pages: AxePage[];
  let redirects: AxeRedirectStub[];
  try {
    const discovered = discoverPages(config);
    pages = discovered.pages;
    redirects = discovered.redirects;
    if (pages.length === 0) {
      error(
        config.pages || config.exclude
          ? `No pages in ${config.siteDir} survived --pages/--exclude.`
          : redirects.length
          ? `Only redirect stubs found in ${config.siteDir} — nothing to scan.`
          : `No *.html pages found in ${config.siteDir}.`,
      );
      return kExitIncomplete;
    }
    pages = applyThemesFilter(pages, config.themes);
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
    // --themes matching nothing is the user's mistake, not an incomplete scan
    return isAxeOptionError(e) ? kExitUsage : kExitIncomplete;
  }

  const anchor = resolveAnchor(config.siteDir);
  const outputDir = join(anchor, kAxeOutputDir);
  const cellsDir = join(outputDir, "cells");
  const baselineFile = join(anchor, kAxeBaselineFile);
  ensureDirSync(cellsDir);
  // The artifact dir must not be committed: a --pages subset scan overwrites
  // findings.json with a subset snapshot, so a committed copy diffs as if
  // findings were fixed. Making the commit impossible beats documenting it —
  // the committed contract is the baseline, which lives beside this dir.
  const gitignoreFile = join(outputDir, ".gitignore");
  if (!existsSync(gitignoreFile)) {
    Deno.writeTextFileSync(
      gitignoreFile,
      "# Written by quarto call axe: everything here is a scan artifact.\n*\n",
    );
  }
  // A previous run's summary artifacts must not survive an aborted scan to be
  // read as current; per-cell payloads accumulate by name as before, and the
  // README stays (its provenance block says which scan wrote it).
  // report.html is the pre-markdown format, cleaned up wherever it lingers.
  for (const staleFile of ["findings.json", "report.md", "report.html"]) {
    const path = join(outputDir, staleFile);
    if (existsSync(path)) {
      Deno.removeSync(path);
    }
  }

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
  // Deno.serve tears down asynchronously after stop() aborts it. Exiting the
  // process mid-teardown intermittently segfaults Deno 2.7 (SIGSEGV on a
  // tokio-runtime-worker, observed three times on macOS with identical
  // stacks; "segfault at exit" is a known upstream bug family). Awaiting the
  // server's own finished promise before returning toward Deno.exit closes
  // the widest of those races.
  const stopServer = async () => {
    server.stop();
    await server.server.finished.catch(() => {});
  };

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
  if (redirects.length) {
    // Expected furniture (aliases:, _redirects stubs) — a quiet note, never
    // the red not-ok treatment a *surprising* redirect gets at scan time.
    const shown = redirects.slice(0, 6)
      .map((stub) => `${stub.path} → ${stub.to ?? "?"}`)
      .join(", ");
    const more = redirects.length > 6 ? `, +${redirects.length - 6} more` : "";
    info(
      `note: ${redirects.length} redirect stub${
        redirects.length === 1 ? "" : "s"
      } skipped (recorded in findings.json): ${shown}${more}`,
    );
  }

  let browser;
  try {
    browser = await launchScanBrowser(findOpenPort(9222));
  } catch (e) {
    // "Chrome not found" throws an empty Error AFTER core has already
    // printed its own explanation and the install suggestion — don't dangle
    // an empty colon after it.
    const detail = e instanceof Error ? e.message : String(e);
    error(
      `Could not start headless Chrome${detail ? `: ${detail}` : "."}`,
    );
    await stopServer();
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
      anchor,
      pages,
      redirects,
      axeVersion: scan.axeVersion,
    });

    const findingsFile = join(outputDir, "findings.json");
    // --report chooses where the markdown report lands (resolved against the
    // working directory, like any user-supplied path); the default sits with
    // the other artifacts.
    const reportFile = config.report
      ? resolve(config.report)
      : join(outputDir, "report.md");
    const readmeFile = join(outputDir, "README.md");
    Deno.writeTextFileSync(findingsFile, JSON.stringify(results, null, 2));
    ensureDirSync(dirname(reportFile));
    Deno.writeTextFileSync(reportFile, renderReport(results));
    Deno.writeTextFileSync(readmeFile, renderReadme(results));

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
    info(`  readme:   ${readmeFile}`);
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
    // Only a complete scan can fail on findings: the incomplete return above
    // is what gives exit 2 precedence over exit 1.
    if (config.failOn) {
      const failing = failingFindings(results.findings, config.failOn);
      if (failing.length) {
        error(
          `  ${failing.length} new finding${
            failing.length === 1 ? "" : "s"
          } at or above --fail-on ${config.failOn}: ` +
            failing.map((finding) => finding.id).join(", "),
        );
        return kExitNewFindings;
      }
    }
    return kExitComplete;
  } catch (e) {
    // scanCell fails its own cell closed; this catches what it can't — the
    // shared setup (Runtime.enable), a stage bug — so the command reports
    // incomplete instead of dying on an uncaught error. The stale summary
    // artifacts were removed up front, so nothing old reads as current.
    error(`Scan aborted: ${e instanceof Error ? e.message : String(e)}`);
    if (e instanceof Error && e.stack) {
      debug(e.stack);
    }
    return kExitIncomplete;
  } finally {
    await browser.close();
    await stopServer();
  }
}

export const axeCommand = new Command()
  .name("axe")
  .hidden()
  .arguments("<site-dir:string>")
  .description(
    "Scan a rendered site for accessibility violations with axe-core.\n\n" +
      "EXPERIMENTAL: flags, artifacts and semantics can change between " +
      "prereleases (see dev-docs/axe-scan.md in the quarto-cli repo).\n\n" +
      "Scans every page in <site-dir> across the viewport x mode " +
      "matrix (modes discovered per page from its HTML), groups violations " +
      "by root-cause signature, reconciles " +
      `${kAxeBaselineFile}, and writes findings.json, report.md and a ` +
      `README to ${kAxeOutputDir}/ at the project root (the nearest ` +
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
    "Cap the number of pages scanned (sorted, first n). Counts scannable " +
      "pages: redirect stubs don't use up the cap.",
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
  .option(
    "--fail-on <impact:string>",
    "Exit 1 when a complete scan has new (non-baselined) findings at or " +
      "above this impact: minor, moderate, serious or critical. An " +
      "incomplete scan still exits 2 — it never reads as a pass.",
  )
  .option(
    "--report <path:string>",
    "Where to write report.md (default: " +
      `${kAxeOutputDir}/report.md at the project root). Use a path inside ` +
      "your site source to render the report with the site.",
  )
  .example(
    "Scan a rendered site",
    "quarto call axe _site",
  )
  .example(
    "Scan two pages, desktop light only",
    "quarto call axe _site --pages index.html,about.html " +
      "--viewports 1440x900 --themes light",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, siteDir: string) => {
    // Flag parsing happens here rather than inside axeScan so a bad value is
    // reported as a usage error. Left to quarto's root handler it would exit
    // 1 — the code this command reserves for "new findings at --fail-on".
    let config: AxeScanConfig;
    try {
      config = axeScanConfig(options, siteDir);
    } catch (e) {
      if (!isAxeOptionError(e)) {
        throw e;
      }
      error(e instanceof Error ? e.message : String(e));
      exitWithCleanup(kExitUsage);
      return;
    }
    const code = await axeScan(config);
    if (code !== kExitComplete) {
      exitWithCleanup(code);
    }
  });
