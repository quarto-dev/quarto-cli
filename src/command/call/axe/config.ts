/*
 * config.ts
 *
 * Command-surface types and flag parsing for `quarto call axe`.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { ErrorEx } from "../../../core/lib/error.ts";
import { AxeImpact, axeImpactSchema } from "./schemas.ts";

// Fixed in v1: this prototype deliberately has no knobs for the output dir,
// the baseline path or whether the report is written.
export const kAxeOutputDir = "_axe-checks";
export const kAxeBaselineFile = "_axe-baseline.json";

// The narrow default is 320 CSS px — the one viewport width WCAG names
// (SC 1.4.10 Reflow: no 2-D scrolling at 320, the 400%-zoom equivalent of a
// 1280 window). axe cannot detect reflow itself, but every rule runs
// against the reflowed layout, and 320 sits in the same Bootstrap
// breakpoint regime as any phone width, so the mobile chrome still renders.
export const kDefaultViewports = "1440x900,320x568";
export const kDefaultThemes = "light,dark";
export const kDefaultTimeout = 30000;
// An additive floor on top of the readiness probe (fonts + double rAF in
// scan.ts), not the whole wait — which is why it is small.
export const kDefaultSettle = 50;

export interface AxeViewport {
  width: number;
  height: number;
  // canonical "WxH" label, used in cell ids and findings.json
  label: string;
}

export type AxeTheme = "light" | "dark";

export interface AxeScanConfig {
  siteDir: string;
  // undefined means "every *.html under siteDir"
  pages?: string[];
  // globs to skip, applied after `pages`; undefined means "skip nothing"
  exclude?: string[];
  // where to write report.md; undefined means `<anchor>/_axe-checks/report.md`
  report?: string;
  // undefined means "no cap"
  maxPages?: number;
  viewports: AxeViewport[];
  themes: AxeTheme[];
  timeout: number;
  settle: number;
  // exit 1 when a complete scan has NEW (non-baselined) findings at or above
  // this impact; undefined means findings never fail the command
  failOn?: AxeImpact;
}

/**
 * A flag the user got wrong — a bad value, or a filter that can't match.
 *
 * Named so both throw sites (`axeScanConfig` here, `applyThemesFilter` in
 * discover.ts) can be recognized and mapped to the usage exit code. Without
 * that, a typo lands on whichever code happens to be nearby, and the command's
 * own 0/1/2 contract loses the meaning it defined.
 */
const kAxeOptionError = "AxeOptionError";

export function isAxeOptionError(e: unknown): boolean {
  return e instanceof Error && e.name === kAxeOptionError;
}

export function optionError(message: string): ErrorEx {
  return new ErrorEx(kAxeOptionError, message, false, false);
}

function splitList(value: string): string[] {
  return value.split(",").map((entry) => entry.trim()).filter((entry) =>
    entry.length > 0
  );
}

function parseViewports(value: string): AxeViewport[] {
  const viewports = splitList(value).map((entry) => {
    const match = entry.match(/^(\d+)x(\d+)$/i);
    if (!match) {
      throw optionError(
        `Invalid viewport '${entry}': expected WxH, e.g. 1440x900.`,
      );
    }
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10),
      label: `${match[1]}x${match[2]}`,
    };
  });
  if (viewports.length === 0) {
    throw optionError("No viewports specified.");
  }
  return viewports;
}

function parseThemes(value: string): AxeTheme[] {
  const themes = splitList(value).map((entry) => {
    const theme = entry.toLowerCase();
    if (theme !== "light" && theme !== "dark") {
      throw optionError(
        `Invalid theme '${entry}': expected 'light' or 'dark'.`,
      );
    }
    return theme;
  });
  if (themes.length === 0) {
    throw optionError("No themes specified.");
  }
  return themes;
}

function parsePositiveInt(value: unknown, flag: string): number {
  const parsed = typeof value === "number" ? value : parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw optionError(
      `Invalid ${flag} '${value}': expected a positive integer.`,
    );
  }
  return parsed;
}

// Zero is meaningful for --settle: it is an additive floor on top of the
// readiness probe, and "no extra delay" is the natural way to trust the probe.
function parseNonNegativeInt(value: unknown, flag: string): number {
  const parsed = typeof value === "number" ? value : parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw optionError(
      `Invalid ${flag} '${value}': expected a non-negative integer.`,
    );
  }
  return parsed;
}

function parseFailOn(value: unknown): AxeImpact {
  const parsed = axeImpactSchema.safeParse(String(value).toLowerCase());
  if (!parsed.success) {
    throw optionError(
      `Invalid --fail-on '${value}': expected minor, moderate, serious or ` +
        `critical.`,
    );
  }
  return parsed.data;
}

// deno-lint-ignore no-explicit-any
export function axeScanConfig(options: any, siteDir: string): AxeScanConfig {
  return {
    siteDir,
    pages: options.pages ? splitList(options.pages) : undefined,
    exclude: options.exclude ? splitList(options.exclude) : undefined,
    report: options.report ? String(options.report) : undefined,
    maxPages: options.maxPages === undefined
      ? undefined
      : parsePositiveInt(options.maxPages, "--max-pages"),
    viewports: parseViewports(options.viewports ?? kDefaultViewports),
    themes: parseThemes(options.themes ?? kDefaultThemes),
    timeout: parsePositiveInt(options.timeout ?? kDefaultTimeout, "--timeout"),
    settle: parseNonNegativeInt(options.settle ?? kDefaultSettle, "--settle"),
    failOn: options.failOn === undefined
      ? undefined
      : parseFailOn(options.failOn),
  };
}
