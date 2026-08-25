/*
 * aggregate.ts
 *
 * The aggregate stage: per-cell axe payloads in, `findings.json` out. Every
 * grouping and labelling decision lives here, so you can re-group without
 * re-scanning and every consumer (report, agent, baseline) reads one contract.
 *
 * Grouping is by ROOT-CAUSE signature rather than exact DOM target, so one
 * defect repeated by shared or generated code collapses into a single finding
 * with a multiplicity count.
 *
 * Ported from the quarto-web harness (`_tools/axe/aggregate.mjs`) with the
 * signature and baseline semantics settled in
 * `aggregate-signature-breadth-investigation.md`: attribute values are kept
 * with digit runs wildcarded (not stripped), and a baseline entry carries a
 * `pages` scope. `--update-baseline` is gone: every entry exists because
 * someone wrote it.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { warning } from "../../../deno_ral/log.ts";
import { quartoConfig } from "../../../core/quarto.ts";
import { md5HashSync } from "../../../core/hash.ts";
import { AxeCell, AxeViolationNode } from "./scan.ts";
import { AxeScanConfig } from "./config.ts";
import { AxePage } from "./discover.ts";
import {
  AxeBaseline,
  AxeFinding,
  AxeFindings,
  AxeImpact,
  AxeOccurrence,
  AxeStaleEntry,
  kFindingsVersion,
  kSignatureScheme,
} from "./schemas.ts";

// Labels mirror the render-time `axe:` report's, without importing its browser
// module into the CLI bundle — see conformance.ts for why, and
// tests/unit/axe-conformance-parity.test.ts for what keeps the two in step.
import {
  axeConformanceLevel,
  impactRank,
  standardRank,
} from "./conformance.ts";

/** Instances-or-pages threshold above which a finding is "systemic". */
const kSystemicMinInstances = 3;

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

// Navigational and index attributes make otherwise-identical template output
// look distinct, so they're dropped entirely rather than value-normalized.
const kVolatileAttr =
  /\[(?:href|data-original-href|data-index|id|name|style)(?:[~^$*|]?=(?:"[^"]*"|'[^']*'|[^\]]*))?\]/g;

/**
 * Normalize an axe target so repeated instances collapse but structure — and
 * component identity — survives.
 *
 * Attribute *values* are kept with digit runs wildcarded. Stripping them (as
 * the harness did) reduced `div[data-bs-target=".callout-4-contents"]` to the
 * generic `div[data-bs-target]`, which every Bootstrap collapse, modal, tab and
 * dropdown also matches — so one accepted callout defect silently suppressed
 * unrelated conformance failures site-wide. Keeping the wildcarded value still
 * collapses `.callout-4-contents`/`.callout-6-contents` into one signature.
 */
export function normalizeSelector(target: string[] | string): string {
  const raw = Array.isArray(target) ? target.join(" > ") : String(target);
  return raw
    // positional: axe's nth-child varies with unrelated sibling edits
    .replace(/:nth-(child|of-type|last-child)\(\d+\)/g, "")
    .replace(kVolatileAttr, "")
    .replace(
      /\[([-\w]+)([~^$*|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*))\]/g,
      (_match, name, op, dq, sq, bare) => {
        const value = (dq ?? sq ?? bare ?? "").replace(/\d+/g, "*");
        return `[${name}${op}"${value}"]`;
      },
    )
    // instance ids: #cb12-1 -> #cb, #fn3 -> #fn
    .replace(/#([A-Za-z][\w-]*?)-?\d+(-\d+)*(?=[\s>~+.:#\[]|$)/g, "#$1")
    .replace(/\s+/g, " ")
    .trim();
}

interface AxeColorContrastData {
  fgColor?: string;
  bgColor?: string;
  contrastRatio?: number;
  expectedContrastRatio?: string;
}

function colorContrastData(
  node: AxeViolationNode,
): AxeColorContrastData | undefined {
  const check = (node.any ?? []).find((entry) => entry.id === "color-contrast");
  return check?.data as AxeColorContrastData | undefined;
}

/**
 * Hybrid signature. For `color-contrast` the root cause is the colour pair, not
 * where it appeared — every token sharing a colour pair is one defect in the
 * theme. Everything else keys on the normalized selector.
 */
export function signatureOf(rule: string, node: AxeViolationNode): string {
  if (rule === "color-contrast") {
    const data = colorContrastData(node);
    if (data?.fgColor && data?.bgColor) {
      return `color-contrast :: ${data.fgColor} on ${data.bgColor}`;
    }
  }
  return `${rule} :: ${normalizeSelector(node.target)}`;
}

/** The contrast numbers, or the first real line of axe's failure summary. */
function nodeDetail(rule: string, node: AxeViolationNode): string {
  if (rule === "color-contrast") {
    const data = colorContrastData(node);
    if (data?.fgColor) {
      return `${data.fgColor} on ${data.bgColor} = ${data.contrastRatio} ` +
        `(needs ${data.expectedContrastRatio})`;
    }
  }
  return (node.failureSummary ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    // axe prefixes the summary with "Fix any of the following:"
    .find((line) => !/^fix (any|all)/i.test(line)) ?? "";
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

const kImpacts: AxeImpact[] = ["critical", "serious", "moderate", "minor"];

function asImpact(impact?: string | null): AxeImpact {
  return kImpacts.includes(impact as AxeImpact)
    ? (impact as AxeImpact)
    : "minor";
}

/** The more severe of two impacts (impactRank is ascending). */
function worstImpact(a: AxeImpact, b: AxeImpact): AxeImpact {
  return impactRank(b) < impactRank(a) ? b : a;
}

/**
 * Stable, human-ish handle so an agent can be pointed at one finding. Derived
 * from the signature, so it is recomputable and changes when the signature does.
 */
export function findingId(rule: string, signature: string): string {
  return `${rule}-${md5HashSync(signature).slice(0, 6)}`;
}

interface Occurrence {
  page: string;
  target: string;
  html: string;
  detail: string;
  cells: Set<string>;
}

interface Group {
  signature: string;
  rule: string;
  impact: AxeImpact;
  tags: string[];
  help: string;
  helpUrl: string;
  detail: string | null;
  /** distinct DOM elements: page + raw target */
  instances: Set<string>;
  pages: Set<string>;
  cells: Set<string>;
  viewports: Set<string>;
  themes: Set<string>;
  examples: Set<string>;
  occurrences: Map<string, Occurrence>;
}

function groupCells(cells: AxeCell[]): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const cell of cells) {
    for (const violation of cell.result!.violations) {
      for (const node of violation.nodes) {
        const signature = signatureOf(violation.id, node);
        let group = groups.get(signature);
        if (!group) {
          group = {
            signature,
            rule: violation.id,
            impact: asImpact(violation.impact),
            tags: violation.tags,
            help: violation.help,
            helpUrl: violation.helpUrl,
            detail: null,
            instances: new Set(),
            pages: new Set(),
            cells: new Set(),
            viewports: new Set(),
            themes: new Set(),
            examples: new Set(),
            occurrences: new Map(),
          };
          groups.set(signature, group);
        }
        group.impact = worstImpact(group.impact, asImpact(violation.impact));

        const target = node.target.join(" > ");
        const key = `${cell.page}##${target}`;
        group.instances.add(key);
        group.pages.add(cell.page);
        group.cells.add(`${cell.page}|${cell.viewport}|${cell.theme}`);
        group.viewports.add(cell.viewport);
        group.themes.add(cell.theme);
        if (group.examples.size < 4) {
          group.examples.add(target);
        }

        let occurrence = group.occurrences.get(key);
        if (!occurrence) {
          occurrence = {
            page: cell.page,
            target,
            html: (node.html ?? "").trim().slice(0, 400),
            detail: nodeDetail(violation.id, node),
            cells: new Set(),
          };
          group.occurrences.set(key, occurrence);
        }
        occurrence.cells.add(`${cell.viewport}·${cell.theme}`);

        if (!group.detail) {
          const detail = nodeDetail(violation.id, node);
          if (detail) {
            group.detail = detail;
          }
        }
      }
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Baseline reconciliation
// ---------------------------------------------------------------------------

/**
 * What the ledger accepts for one signature, merged across entries.
 *
 * `pages` scopes the acceptance and empty means site-wide. A page-scoped
 * acceptance is fail-closed at finding level: the finding is known only while
 * *every* page it occurs on is listed, so the same signature on one unlisted
 * page re-alerts the whole finding, known occurrences included.
 */
interface Acceptance {
  siteWide: boolean;
  pages: Set<string>;
  /** Impact at acceptance: escalation past this re-alerts. */
  impact: AxeImpact;
  notes: string[];
  entryIds: (string | undefined)[];
  rules: (string | undefined)[];
}

export function acceptances(baseline: AxeBaseline): Map<string, Acceptance> {
  const accepted = new Map<string, Acceptance>();
  for (const entry of baseline.findings) {
    const existing = accepted.get(entry.signature);
    if (existing) {
      // One entry per signature is the intended shape. Merging is defined
      // (union the scope, take the most severe accepted impact) but ambiguous
      // enough to be worth saying out loud rather than resolving silently.
      warning(
        `axe baseline: duplicate entries for signature '${entry.signature}' — ` +
          `merging their pages and taking the most severe accepted impact. ` +
          `Consider combining them into one entry.`,
      );
      existing.siteWide = existing.siteWide || entry.pages.length === 0;
      for (const page of entry.pages) {
        existing.pages.add(page);
      }
      existing.impact = worstImpact(existing.impact, entry.impact);
      existing.notes.push(entry.note);
      existing.entryIds.push(entry.id);
      existing.rules.push(entry.rule);
    } else {
      accepted.set(entry.signature, {
        siteWide: entry.pages.length === 0,
        pages: new Set(entry.pages),
        impact: entry.impact,
        notes: [entry.note],
        entryIds: [entry.id],
        rules: [entry.rule],
      });
    }
  }
  return accepted;
}

interface Reconciled {
  baselined: boolean;
  baselineNote: string | null;
}

export function reconcile(
  finding: { signature: string; impact: AxeImpact; pages: string[] },
  accepted: Map<string, Acceptance>,
): Reconciled {
  const acceptance = accepted.get(finding.signature);
  if (!acceptance) {
    return { baselined: false, baselineNote: null };
  }
  const note = acceptance.notes.filter(Boolean).join(" · ") || null;

  // Escalation past the accepted impact re-alerts rather than hiding behind an
  // old acceptance.
  if (impactRank(finding.impact) < impactRank(acceptance.impact)) {
    return { baselined: false, baselineNote: note };
  }
  if (acceptance.siteWide) {
    return { baselined: true, baselineNote: note };
  }
  const covered = finding.pages.every((page) => acceptance.pages.has(page));
  return { baselined: covered, baselineNote: note };
}

/**
 * Baseline entries not seen in this scan: site-wide entries whose signature
 * didn't occur at all, and page-scoped entries whose signature didn't occur on
 * any listed page. Reported, never auto-pruned — "resolved" is only confirmable
 * on a full-site scan, since on a subset scan an entry may live on an unscanned
 * page.
 */
export function staleEntries(
  accepted: Map<string, Acceptance>,
  findings: { signature: string; pages: string[] }[],
): AxeStaleEntry[] {
  const seen = new Map<string, Set<string>>();
  for (const finding of findings) {
    let pages = seen.get(finding.signature);
    if (!pages) {
      pages = new Set();
      seen.set(finding.signature, pages);
    }
    for (const page of finding.pages) {
      pages.add(page);
    }
  }

  const stale: AxeStaleEntry[] = [];
  for (const [signature, acceptance] of accepted) {
    const pages = seen.get(signature);
    const wasSeen = acceptance.siteWide
      ? pages !== undefined
      : pages !== undefined &&
        [...acceptance.pages].some((page) => pages.has(page));
    if (!wasSeen) {
      stale.push({
        signature,
        id: acceptance.entryIds.find(Boolean) ?? null,
        rule: acceptance.rules.find(Boolean) ?? null,
        pages: [...acceptance.pages].sort(),
        note: acceptance.notes.filter(Boolean).join(" · "),
      });
    }
  }
  return stale.sort((a, b) => a.signature.localeCompare(b.signature));
}

// ---------------------------------------------------------------------------
// findings.json
// ---------------------------------------------------------------------------

export interface AggregateOptions {
  cells: AxeCell[];
  config: AxeScanConfig;
  baseline: AxeBaseline;
  baselineFile: string;
  pages: AxePage[];
  axeVersion?: string;
}

export function aggregate(options: AggregateOptions): AxeFindings {
  const { cells, config, baseline, baselineFile, pages } = options;
  const okCells = cells.filter((cell) => cell.status === "ok" && cell.result);
  const notOkCells = cells.filter((cell) => cell.status !== "ok");

  const groups = groupCells(okCells);
  const accepted = acceptances(baseline);

  const findings: AxeFinding[] = [];
  for (const group of groups.values()) {
    const conformance = axeConformanceLevel(group.tags);
    // the version+level alone, without the success-criteria parenthetical
    const standard = conformance.replace(/\s*\([^)]*\)\s*$/, "") || "—";
    const findingPages = [...group.pages].sort();
    const instances = group.instances.size;
    const { baselined, baselineNote } = reconcile(
      { signature: group.signature, impact: group.impact, pages: findingPages },
      accepted,
    );

    findings.push({
      id: findingId(group.rule, group.signature),
      signature: group.signature,
      rule: group.rule,
      impact: group.impact,
      conformance,
      standard,
      standardRank: standardRank(group.tags),
      severityRank: impactRank(group.impact),
      bestPractice: group.tags.includes("best-practice"),
      help: group.help,
      helpUrl: group.helpUrl,
      detail: group.detail,
      baselined,
      baselineNote,
      // systemic = repeated source: many elements, or more than one page
      label: instances >= kSystemicMinInstances || group.pages.size >= 2
        ? "systemic"
        : "localized",
      instances,
      pages: findingPages,
      cells: group.cells.size,
      viewports: [...group.viewports].sort(),
      themes: [...group.themes].sort(),
      examples: [...group.examples],
      occurrences: [...group.occurrences.values()]
        .map((occurrence): AxeOccurrence => ({
          page: occurrence.page,
          target: occurrence.target,
          html: occurrence.html,
          detail: occurrence.detail,
          cells: [...occurrence.cells].sort(),
        }))
        .sort((a, b) =>
          a.page.localeCompare(b.page) || a.target.localeCompare(b.target)
        ),
    });
  }

  // Default order: by standard (WCAG level first, best-practice and obsolete
  // last), then severity, then reach. The HTML report can re-sort any column.
  findings.sort((a, b) =>
    a.standardRank - b.standardRank ||
    a.severityRank - b.severityRank ||
    b.instances - a.instances ||
    b.pages.length - a.pages.length
  );

  const newCount = findings.filter((finding) => !finding.baselined).length;

  return {
    version: kFindingsVersion,
    signatureScheme: kSignatureScheme,
    generated: new Date().toISOString(),
    quartoVersion: quartoConfig.version(),
    axeVersion: options.axeVersion ??
      okCells[0]?.result?.testEngine?.version ?? null,
    config: {
      siteDir: config.siteDir,
      viewports: config.viewports.map((viewport) => viewport.label),
      themes: [...config.themes],
      pages: config.pages ?? null,
      exclude: config.exclude ?? null,
      maxPages: config.maxPages ?? null,
      timeout: config.timeout,
      settle: config.settle,
    },
    // `modes` are the modes this scan covered for the page (post `--themes`),
    // so a CI consumer can tell "no dark mode" from "a cell went missing".
    pages: pages.map((page) => ({ output: page.path, modes: page.modes })),
    cells: {
      total: cells.length,
      ok: okCells.length,
      notOk: notOkCells.length,
    },
    notOkCells: notOkCells.map((cell) => ({
      page: cell.page,
      viewport: cell.viewport,
      theme: cell.theme,
      status: cell.status,
      message: cell.message ?? null,
    })),
    pagesScanned: new Set(okCells.map((cell) => cell.page)).size,
    baseline: {
      file: baselineFile,
      entries: accepted.size,
      stale: staleEntries(accepted, findings),
    },
    counts: {
      total: findings.length,
      new: newCount,
      baselined: findings.length - newCount,
    },
    findings,
  };
}
