/*
 * discover.ts
 *
 * Page discovery for `quarto dev-call axe`: which pages to scan, and — per
 * page — which colour modes exist to scan them in.
 *
 * Modes are discovered from the rendered HTML, never probed at runtime. A page
 * ships one presentation or two, per page (front matter can add or remove a
 * dark theme), and the rendered file says which: Quarto writes its inline
 * colour-scheme script iff the page has two modes. So the whole matrix is
 * known — and printable — before the browser launches.
 * See llm-docs/html-dark-mode-architecture.md.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { globToRegExp, join, relative } from "../../../deno_ral/path.ts";
import { walkSync } from "../../../deno_ral/fs.ts";
import { pathWithForwardSlashes } from "../../../core/path.ts";
import { ErrorEx } from "../../../core/lib/error.ts";
import { AxeScanConfig, AxeTheme, kAxeOutputDir } from "./config.ts";

/**
 * The colour mode of one cell. `light` and `dark` are the author's two slots
 * on a two-mode page. `default` is the single presentation of a one-mode page
 * — uniformly, whether the page is Bootstrap or hand-written, and whatever
 * colour that presentation happens to be (see `darkColoured`).
 */
export type AxeMode = AxeTheme | "default";

/** One page to scan, with its discovered mode axis. */
export interface AxePage {
  /** Site-relative forward-slash path, e.g. `docs/index.html`. */
  path: string;
  /** `["light", "dark"]` for a two-mode page, `["default"]` otherwise. */
  modes: AxeMode[];
  /**
   * A one-mode page whose single theme is dark-coloured (`theme: darkly`).
   * An annotation only — the cell is still named `default`, because a measured
   * colour label would be honest only for Bootstrap pages.
   */
  darkColoured: boolean;
}

/**
 * The marker for "this page has two modes": the inline before-body script that
 * defines `window.quartoToggleColorScheme`. It is emitted iff
 * `formatDarkMode(format) !== undefined` — the single upstream predicate — and
 * unlike the toggle *element* it is present in the static HTML. The alternate
 * stylesheet links are NOT a usable marker: a light-only `_brand.yml` emits
 * them with no dark mode behind them (fixture: sites/brand-light-only).
 */
const kTwoModeMarker = "quartoToggleColorScheme";

/**
 * Discover a page's modes from its rendered HTML.
 *
 * `darkColoured` is read from the page's sole `id="quarto-bootstrap"` link:
 * its `data-mode` measures the compiled CSS's blackness, so `"dark"` on a
 * one-mode page means `theme: darkly` (or similar) — a visually dark page that
 * every declaration-level signal calls light. Multiple bootstrap links mean
 * the split-brand machinery is in play and the measurement is not the page's.
 */
export function sniffModes(
  html: string,
): { modes: AxeMode[]; darkColoured: boolean } {
  if (html.includes(kTwoModeMarker)) {
    return { modes: ["light", "dark"], darkColoured: false };
  }
  const bootstrapLinks =
    html.match(/<link\b[^>]*\bid="quarto-bootstrap"[^>]*>/g) ?? [];
  const darkColoured = bootstrapLinks.length === 1 &&
    /\bdata-mode="dark"/.test(bootstrapLinks[0]);
  return { modes: ["default"], darkColoured };
}

/** A page that exists only to send the visitor elsewhere, skipped as content. */
export interface AxeRedirectStub {
  /** Site-relative forward-slash path of the stub. */
  path: string;
  /** Destination, when the stub's markup names one. */
  to: string | null;
}

/**
 * Recognize a redirect stub from its rendered HTML.
 *
 * Quarto emits two shapes — `redirect-simple.ejs` (a zero-delay meta refresh,
 * also the shape of hand-generated stubs like positron-website's `_redirects`
 * script) and `redirect-map.ejs` (`aliases:` front matter; a hash-keyed
 * `window.location.replace` map). A stub is site furniture, not scannable
 * content: failing its cells as not-ok made every `aliases:` site read as a
 * broken scan. Skipped stubs are recorded, never silently dropped, and the
 * scan-time redirect guard (scan.ts) remains the fail-closed net for
 * redirects this sniff can't see.
 *
 * The near-empty-body requirement keeps documentation *about* redirects out:
 * a real content page carries navigation chrome; a stub's body is bytes.
 */
export function sniffRedirectStub(
  html: string,
): { to: string | null } | undefined {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  if (body.trim().length > 1000) {
    return undefined;
  }
  const meta = html.match(/<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*>/i);
  if (meta) {
    const target = meta[0].match(/url\s*=\s*["']?([^"'>;]+)/i);
    return { to: target ? target[1].trim() : null };
  }
  if (html.includes("window.location.replace")) {
    const map = html.match(/var redirects = (\{[^;]*\});/);
    if (map) {
      try {
        const redirects = JSON.parse(map[1]) as Record<string, string>;
        return { to: redirects[""] ?? Object.values(redirects)[0] ?? null };
      } catch (_e) {
        return { to: null };
      }
    }
  }
  return undefined;
}

/**
 * Directories whose HTML is never site content, skipped at any depth:
 * `_axe-checks` is the scanner's own output (when the anchor is the site dir —
 * `output-dir: "."`, or loose HTML scanned from inside it — a rerun would
 * otherwise scan its own report), and `site_libs` is vendored library code
 * (reveal ships `plugin/notes/speaker-view.html`), whose findings belong
 * upstream, not to the site's author.
 */
const kSkippedDirs: string[] = [kAxeOutputDir, "site_libs"];

/** What discovery found: the pages to scan, and the redirect stubs it set aside. */
export interface DiscoveredPages {
  pages: AxePage[];
  redirects: AxeRedirectStub[];
}

/**
 * Every `*.html` under `siteDir`, as sorted site-relative forward-slash paths
 * (minus `kSkippedDirs`), narrowed by `--pages`, pruned by `--exclude` and
 * capped by `--max-pages` — sorting before the cap is what makes `--max-pages`
 * deterministic — then each surviving page read once, classified as a
 * redirect stub or a page, and (for pages) its modes discovered. Stubs are
 * classified after the cap, so a capped scan may cover fewer than
 * `--max-pages` real pages.
 */
export function discoverPages(config: AxeScanConfig): DiscoveredPages {
  const paths: string[] = [];
  for (const entry of walkSync(config.siteDir, { includeDirs: false })) {
    if (entry.path.endsWith(".html")) {
      const path = pathWithForwardSlashes(relative(config.siteDir, entry.path));
      if (path.split("/").some((segment) => kSkippedDirs.includes(segment))) {
        continue;
      }
      paths.push(path);
    }
  }
  paths.sort();

  // A bare directory name also matches everything beneath it, so
  // `--exclude slides` behaves like `--exclude slides/**` instead of silently
  // excluding nothing. (Full alignment with core/path.ts glob semantics —
  // `!` negation, implicit `**/` prefixes — is a public-command question.)
  const compile = (globs: string[]) =>
    globs.flatMap((glob) => [glob, `${glob}/**`])
      .map((glob) => globToRegExp(glob, { extended: true, globstar: true }));

  let selected = paths;
  if (config.pages) {
    const patterns = compile(config.pages);
    selected = paths.filter((path) =>
      patterns.some((pattern) => pattern.test(path))
    );
  }
  // After --pages, before the cap: an exclusion should free cap room for the
  // pages that remain.
  if (config.exclude) {
    const patterns = compile(config.exclude);
    selected = selected.filter((path) =>
      !patterns.some((pattern) => pattern.test(path))
    );
  }
  if (config.maxPages !== undefined) {
    selected = selected.slice(0, config.maxPages);
  }

  const pages: AxePage[] = [];
  const redirects: AxeRedirectStub[] = [];
  for (const path of selected) {
    const html = Deno.readTextFileSync(join(config.siteDir, path));
    const stub = sniffRedirectStub(html);
    if (stub) {
      redirects.push({ path, to: stub.to });
      continue;
    }
    const { modes, darkColoured } = sniffModes(html);
    pages.push({ path, modes, darkColoured });
  }
  return { pages, redirects };
}

/**
 * Apply `--themes` to the discovered matrix.
 *
 * The flag is a filter, and its job is cost control: it prunes the light/dark
 * pair on two-mode pages, while `default` cells are always included — so
 * `--themes light` means "one cell per page", never "skip the one-mode pages".
 *
 * A filter that matches zero cells is an error rather than an empty (or
 * silently unfiltered) scan: asking for `--themes dark` on a site with no
 * two-mode pages would otherwise scan every page once and read as dark
 * coverage.
 */
export function applyThemesFilter(
  pages: AxePage[],
  themes: AxeTheme[],
): AxePage[] {
  const narrowed = !(themes.includes("light") && themes.includes("dark"));
  if (narrowed) {
    const matched = pages.some((page) =>
      page.modes.some((mode) => mode !== "default" && themes.includes(mode))
    );
    if (!matched) {
      throw new ErrorEx(
        "AxeOptionError",
        `--themes ${themes.join(",")} matched no cells: no page here has a ` +
          `light/dark mode pair, so every page scans once as 'default'. ` +
          `Drop --themes.`,
        false,
        false,
      );
    }
  }
  return pages.map((page) => ({
    ...page,
    modes: page.modes.filter((mode) =>
      mode === "default" || themes.includes(mode)
    ),
  }));
}
