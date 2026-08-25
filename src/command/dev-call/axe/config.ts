/*
 * config.ts
 *
 * Command-surface types and flag parsing for `quarto dev-call axe`.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { ErrorEx } from "../../../core/lib/error.ts";

// Fixed in v1: this prototype deliberately has no knobs for the output dir,
// the baseline path or whether the report is written.
export const kAxeOutputDir = "_axe-checks";
export const kAxeBaselineFile = "_axe-baseline.json";

export const kDefaultViewports = "1440x900,390x844";
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
  // undefined means "no cap"
  maxPages?: number;
  viewports: AxeViewport[];
  themes: AxeTheme[];
  timeout: number;
  settle: number;
}

function optionError(message: string): ErrorEx {
  return new ErrorEx("AxeOptionError", message, false, false);
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

// deno-lint-ignore no-explicit-any
export function axeScanConfig(options: any, siteDir: string): AxeScanConfig {
  return {
    siteDir,
    pages: options.pages ? splitList(options.pages) : undefined,
    maxPages: options.maxPages === undefined
      ? undefined
      : parsePositiveInt(options.maxPages, "--max-pages"),
    viewports: parseViewports(options.viewports ?? kDefaultViewports),
    themes: parseThemes(options.themes ?? kDefaultThemes),
    timeout: parsePositiveInt(options.timeout ?? kDefaultTimeout, "--timeout"),
    settle: parsePositiveInt(options.settle ?? kDefaultSettle, "--settle"),
  };
}
