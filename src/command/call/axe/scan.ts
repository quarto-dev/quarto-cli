/*
 * scan.ts
 *
 * The scan stage of `quarto call axe`: drives headless Chrome over raw CDP
 * and runs quarto-cli's vendored axe-core against every page x viewport x mode
 * cell of an already-rendered site. The mode axis is discovered per page before
 * the browser launches (see discover.ts); this stage only *selects* each cell's
 * mode, by seeding Quarto's own localStorage key before navigation.
 *
 * Ported from the quarto-web harness (`_tools/axe/scan.mjs`), with one
 * architectural change: axe is injected at scan time rather than by a
 * render-time hook, so any rendered site scans as-is and offline.
 *
 * Cells fail CLOSED. A timeout, an evaluation error, or a result that doesn't
 * look like an axe payload is an infrastructure failure in the output and in
 * the exit code — never a pass.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "../../../deno_ral/path.ts";
import { md5HashSync } from "../../../core/hash.ts";
import { sleep } from "../../../core/async.ts";
import { formatResourcePath } from "../../../core/resources.ts";
import { launchChrome } from "../../../core/cri/launch.ts";
import cdp from "../../../core/cri/deno-cri/index.js";
import { AxeScanConfig, AxeViewport } from "./config.ts";
import { AxeMode, AxePage } from "./discover.ts";

/** Status of a single scanned cell. Anything but "ok" fails closed. */
export type AxeCellStatus =
  | "ok"
  | "timeout"
  | "error"
  | "no-payload"
  | "redirected";

/** One of axe's check results on a node; `data` carries rule-specific detail. */
export interface AxeCheckResult {
  id: string;
  data?: unknown;
}

/** A single axe violation node, as axe-core reports it. */
export interface AxeViolationNode {
  html: string;
  target: string[];
  failureSummary?: string;
  impact?: string | null;
  // The scan keeps axe's nodes whole, so the check arrays survive to the
  // aggregate stage — color-contrast reads its colour pair out of `any`.
  any?: AxeCheckResult[];
  all?: AxeCheckResult[];
  none?: AxeCheckResult[];
}

/** A single axe violation, as axe-core reports it. */
export interface AxeViolation {
  id: string;
  impact?: string | null;
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeViolationNode[];
}

/** The slice of axe-core's `axe.run()` payload the scanner keeps. */
export interface AxeRunResult {
  violations: AxeViolation[];
  testEngine?: { name: string; version: string };
  url?: string;
  timestamp?: string;
}

/** One page x viewport x mode cell: the unit of scanning and of fail-closed. */
export interface AxeCell {
  page: string;
  viewport: string;
  /** The colour mode this cell scanned: an author slot, or `default`. */
  theme: AxeMode;
  url: string;
  status: AxeCellStatus;
  /**
   * The page's single mode is dark-coloured (`theme: darkly`). An annotation
   * carried from discovery — never part of the cell's name.
   */
  darkColoured?: boolean;
  /** Present when status is not "ok". */
  message?: string;
  /** Present when status is "ok". */
  result?: AxeRunResult;
  /** Wall-clock milliseconds spent on this cell. */
  elapsed: number;
}

// ---------------------------------------------------------------------------
// CDP client
// ---------------------------------------------------------------------------

/**
 * The slice of the vendored deno-cri client this file uses, written down:
 * deno-cri is untyped JavaScript (src/core/cri/deno-cri/), so this interface
 * is the contract, not a re-export of one.
 */
type CdpEventHandler = (params?: Record<string, unknown>) => void;

interface DenoCriConnection {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, handler: CdpEventHandler): void;
  off(event: string, handler: CdpEventHandler): void;
  close(): Promise<void>;
}

const connectDenoCri = cdp as (
  options: { port: number },
) => Promise<DenoCriConnection>;

/** The one message for "this connection is gone", wherever that is noticed. */
const kConnectionClosed = "CDP connection closed";

function asError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Minimal Chrome DevTools Protocol client: send a command and await its
 * result, wait (cancellably) for one event, close. Three capabilities, because
 * three is what the scanner needs — the scan logic is the CDP *commands* that
 * scanCell sends through here, and those are not shared with anything.
 *
 * The socket underneath is the vendored deno-cri client, the same one
 * src/core/cri/cri.ts drives mermaid with. What this adds is the part
 * fail-closed cells depend on and deno-cri does not have: a lost connection
 * rejects every command still in flight, so a crashed tab fails one cell
 * instead of hanging the scan (llm-docs/axe-scan-architecture.md, "The scan
 * stage"). cri.ts's *facade* is still no use here — it exposes
 * navigate/query/screenshot only, with no emulation and no awaitPromise.
 */
export class CdpClient {
  private pending = new Set<(err: Error) => void>();
  private closed = false;

  private constructor(private readonly connection: DenoCriConnection) {
    // deno-cri notices the socket going away, but leaves the commands that
    // were in flight when it went unsettled forever.
    connection.on("disconnect", () => this.abandonPending());
  }

  /**
   * Connect to the page target on `port`. Connecting the instant the CDP
   * endpoint answers is racy: cri.ts measured the failure rate against the
   * gap between tries (see criClient.open) and settled on 100ms, which is
   * what this retries with.
   */
  static async connect(port: number): Promise<CdpClient> {
    const maxTries = 5;
    for (let attempt = 1;; ++attempt) {
      try {
        return new CdpClient(await connectDenoCri({ port }));
      } catch (e) {
        if (attempt === maxTries) {
          throw new Error(
            `Failed to connect to CDP on port ${port}: ${asError(e).message}`,
          );
        }
        await sleep(100);
      }
    }
  }

  send<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    if (this.closed) {
      return Promise.reject(new Error(kConnectionClosed));
    }
    return new Promise<T>((resolve, reject) => {
      // Tracked so close() — or a dropped socket — can reject it. Settling a
      // promise twice is a no-op, so a late reply after that is harmless.
      this.pending.add(reject);
      this.connection.send(method, params).then(
        (result) => {
          this.pending.delete(reject);
          resolve(result as T);
        },
        (e) => {
          this.pending.delete(reject);
          reject(asError(e));
        },
      );
    });
  }

  /**
   * Resolve on the next occurrence of `method`. The returned `cancel` must be
   * called when the caller stops caring (e.g. the cell timed out), so a late
   * event can't resolve a waiter that belongs to a previous cell.
   */
  once(
    method: string,
  ): { event: Promise<Record<string, unknown>>; cancel: () => void } {
    let handler: CdpEventHandler = () => {};
    const event = new Promise<Record<string, unknown>>((resolve) => {
      handler = (params) => {
        this.connection.off(method, handler);
        resolve(params ?? {});
      };
      this.connection.on(method, handler);
    });
    return { event, cancel: () => this.connection.off(method, handler) };
  }

  close() {
    if (this.closed) {
      return;
    }
    this.abandonPending();
    // deno-cri's close() resolves on the socket's close event. Don't wait for
    // it: the caller kills the browser next, and teardown must not be able to
    // hang on a connection that is already the problem.
    this.connection.close().catch(() => {});
  }

  private abandonPending() {
    this.closed = true;
    const pending = [...this.pending];
    this.pending.clear();
    for (const reject of pending) {
      reject(new Error(kConnectionClosed));
    }
  }
}

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------

export interface ScanBrowser {
  client: CdpClient;
  close: () => Promise<void>;
}

/**
 * Launch headless Chrome on its own CDP port and connect to its page target.
 * The process itself is the shared launcher's job (src/core/cri/launch.ts);
 * what is scanner-specific is the isolated profile, so the scan cannot attach
 * to a Chrome the user already has running, and hiding scrollbars, which are
 * browser chrome rather than page content and eat viewport width at 320px.
 */
export async function launchScanBrowser(port: number): Promise<ScanBrowser> {
  const browser = await launchChrome({
    port,
    args: ["--hide-scrollbars"],
    url: "about:blank",
    isolatedProfile: true,
    logPrefix: "axe chrome",
  });

  let client: CdpClient;
  try {
    client = await CdpClient.connect(browser.port);
  } catch (e) {
    await browser.close();
    const detail = browser.stderrTail().trim();
    throw new Error(
      asError(e).message + (detail ? `\nChrome said: ${detail}` : ""),
    );
  }

  return {
    client,
    close: async () => {
      client.close();
      await browser.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

/** Path to the axe-core build quarto-cli already ships for HTML output. */
export function vendoredAxePath(): string {
  return formatResourcePath("html", join("axe", "axe.min.js"));
}

// The whole document is in scope: what the scan sees is what the site ships.
// `document` is passed explicitly because axe.run() overloads its first
// argument between context and options.
const kAxeRunExpression = `
(function () {
  return axe.run(
    document,
    // v1 reports violations only, so axe can skip collecting full pass detail.
    { resultTypes: ["violations"] }
  ).then(function (result) {
    return {
      violations: result.violations,
      testEngine: result.testEngine,
      url: result.url,
      timestamp: result.timestamp,
    };
  });
})()
`;

/**
 * Select a two-mode page's mode before navigation.
 *
 * `localStorage["quarto-color-scheme"]` is Quarto's own persistence for the
 * colour-scheme toggle: `"alternate"` is the dark slot (always), `"default"`
 * the other. The inline before-body script applies a stored value during
 * parse, before first paint, and an explicit stored value wins in both
 * `respect-user-color-scheme` settings — so seeding it via
 * `Page.addScriptToEvaluateOnNewDocument` (which runs before parse) selects
 * the mode deterministically: no toggle click, no post-swap settle, no
 * cross-cell leak to manage. On `file:`/opaque origins setItem throws; those
 * pages have no localStorage-reading script either, so swallowing it is right.
 */
function colorSchemeSeedSource(mode: AxeMode): string {
  const value = mode === "dark" ? "alternate" : "default";
  return `try {
  window.localStorage.setItem("quarto-color-scheme", "${value}");
} catch (_e) { /* no localStorage on this origin: nothing reads it either */ }`;
}

/**
 * The mode the loaded page says it is in. Every Bootstrap page carries
 * `quarto-light` or `quarto-dark` on `body` — identifying the active *slot*,
 * kept in sync by the before-body script — so on a two-mode page this verifies
 * the seed took. Null where no such class exists.
 */
const kBodyModeProbe = `
(function () {
  var cls = document.body ? document.body.classList : null;
  if (!cls) return null;
  if (cls.contains("quarto-dark")) return "dark";
  if (cls.contains("quarto-light")) return "light";
  return null;
})()
`;

/**
 * Readiness instead of a fixed worst-case delay: the page is ready for axe
 * once webfonts have loaded (`document.fonts.ready` — fonts move layout and
 * decide contrast against backgrounds) and two animation frames have painted
 * (layout from deferred scripts has run and been committed). `--settle` then
 * applies on top as an additive floor for pages with slower client-side
 * rendering axe would otherwise catch mid-paint.
 */
const kReadinessProbe = `
(async function () {
  var ready = (async function () {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise(function (resolve) {
      requestAnimationFrame(function () { requestAnimationFrame(resolve); });
    });
  })();
  // Readiness is best-effort, capped: a hanging subresource (an offline
  // webfont fetch, say) must not convert a scannable page into a per-cell
  // --timeout failure.
  var cap = new Promise(function (resolve) { setTimeout(resolve, 2000); });
  await Promise.race([ready, cap]);
  return true;
})()
`;

/** The old fixed delay, kept as the fallback when the probe can't run. */
const kReadinessFallback = 500;

/** Where the document actually is, read after load and settle. */
const kLocationProbe = `window.location.href`;

/**
 * Compare the requested URL with where the document ended up, by origin and
 * path. A zero-delay meta refresh (redirect stubs generated from a
 * `_redirects` file), a JS redirect or a server redirect moves the document
 * during the settle window, and axe would otherwise audit the destination —
 * an external site, on the site that found this — under the requested page's
 * name. Search and hash are ignored: reveal decks rewrite the fragment via
 * the history API, and that is still the same page.
 *
 * Returns where the page went, or undefined when it stayed put.
 */
export function redirectTarget(
  requested: string,
  actual: string,
): string | undefined {
  if (!actual) {
    // no location at all is not the requested page — callers that can tell
    // "probe returned nothing" from "the page moved" should do so upstream
    return "(unknown location)";
  }
  try {
    const from = new URL(requested);
    // resolved against the request, so a relative document URL (axe's
    // result.url on an exotic page) compares by where it actually points
    const to = new URL(actual, from);
    if (from.origin === to.origin && from.pathname === to.pathname) {
      return undefined;
    }
    return actual;
  } catch (_e) {
    // an unparseable location is not the requested page
    return actual;
  }
}

interface RuntimeEvaluateResult {
  result?: { value?: unknown };
  exceptionDetails?: { text?: string; exception?: { description?: string } };
}

function evaluateError(response: RuntimeEvaluateResult): string | undefined {
  const details = response.exceptionDetails;
  if (!details) {
    return undefined;
  }
  return details.exception?.description ?? details.text ?? "evaluation failed";
}

/** Exported for unit tests; runAxeScan is the real caller. */
export async function scanCell(
  client: CdpClient,
  axeSource: string,
  config: AxeScanConfig,
  page: AxePage,
  viewport: AxeViewport,
  mode: AxeMode,
  url: string,
): Promise<AxeCell> {
  const started = Date.now();
  const cell = (
    status: AxeCellStatus,
    extra: Partial<AxeCell> = {},
  ): AxeCell => ({
    page: page.path,
    viewport: viewport.label,
    theme: mode,
    url,
    status,
    ...(page.darkColoured ? { darkColoured: true } : {}),
    elapsed: Date.now() - started,
    ...extra,
  });

  // Registered before navigation, removed after the cell — including on the
  // timeout path, so a stale seed can't run under a later cell's navigation.
  let seedId: string | undefined;

  const load = client.once("Page.loadEventFired");
  // The try/catch is the transport half of fail-closed: an in-page failure is
  // handled per step below, but a rejected send — a crashed tab, a dropped
  // WebSocket, a CDP protocol error — must fail this cell, not the whole scan.
  // If the connection is really dead, every later cell fails fast the same way
  // and the exit code says incomplete; the cells scanned so far stay reported.
  const run = (async (): Promise<AxeCell> => {
    try {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      // Kept aligned with the mode for the sake of any hand-written
      // prefers-color-scheme CSS. It cannot select a Quarto mode — the themes
      // ignore it unless respect-user-color-scheme is set — and where it could
      // (respect-user-color-scheme: true), the seeded stored value wins anyway.
      await client.send("Emulation.setEmulatedMedia", {
        features: [{
          name: "prefers-color-scheme",
          value: mode === "dark" ? "dark" : "light",
        }],
      });
      if (mode !== "default") {
        const seeded = await client.send<{ identifier?: string }>(
          "Page.addScriptToEvaluateOnNewDocument",
          { source: colorSchemeSeedSource(mode) },
        );
        seedId = seeded.identifier;
      }

      const navigation = await client.send<{ errorText?: string }>(
        "Page.navigate",
        { url },
      );
      if (navigation.errorText) {
        return cell("error", {
          message: `navigation failed: ${navigation.errorText}`,
        });
      }
      await load.event;

      // Wait for the page to report ready, then apply --settle as an additive
      // floor. The probe failing has two causes with one safe answer: a
      // redirect destroyed its context mid-wait (the location guard below
      // names it), or the page's JS is pathological — either way, fall back
      // to the old fixed delay rather than scanning mid-layout.
      try {
        const ready = await client.send<RuntimeEvaluateResult>(
          "Runtime.evaluate",
          {
            expression: kReadinessProbe,
            awaitPromise: true,
            returnByValue: true,
          },
        );
        if (evaluateError(ready)) {
          await sleep(kReadinessFallback);
        }
      } catch (_e) {
        await sleep(kReadinessFallback);
      }
      await sleep(config.settle);

      // The document must still be the page we asked for: a redirect fires
      // during the settle window, and axe would otherwise audit the
      // destination under this page's name. Fail closed at the site boundary.
      const located = await client.send<RuntimeEvaluateResult>(
        "Runtime.evaluate",
        { expression: kLocationProbe, returnByValue: true },
      );
      const locateError = evaluateError(located);
      if (locateError) {
        return cell("error", {
          message: `location probe failed: ${locateError}`,
        });
      }
      const href = located.result?.value;
      if (typeof href !== "string" || href.length === 0) {
        // a probe that resolves without a URL is an infrastructure failure,
        // not a redirect — don't send anyone hunting for one
        return cell("error", {
          message: "location probe returned no URL",
        });
      }
      const movedTo = redirectTarget(url, href);
      if (movedTo !== undefined) {
        return cell("redirected", {
          message: `page redirected to ${movedTo} — not scanned`,
        });
      }

      // Verify the seed took, from the body class where one exists. A mismatch
      // is an infrastructure failure: the cell would really be the other mode,
      // and fail-closed beats miscounted coverage.
      if (mode !== "default") {
        const probed = await client.send<RuntimeEvaluateResult>(
          "Runtime.evaluate",
          { expression: kBodyModeProbe, returnByValue: true },
        );
        const active = evaluateError(probed) ? null : probed.result?.value;
        if (active != null && active !== mode) {
          return cell("error", {
            message: `page loaded in ${active} mode, expected ${mode}`,
          });
        }
      }

      const injected = await client.send<RuntimeEvaluateResult>(
        "Runtime.evaluate",
        { expression: axeSource, returnByValue: false },
      );
      const injectError = evaluateError(injected);
      if (injectError) {
        return cell("error", {
          message: `axe injection failed: ${injectError}`,
        });
      }

      const evaluated = await client.send<RuntimeEvaluateResult>(
        "Runtime.evaluate",
        {
          expression: kAxeRunExpression,
          awaitPromise: true,
          returnByValue: true,
        },
      );
      const runError = evaluateError(evaluated);
      if (runError) {
        return cell("error", {
          message: `axe.run() failed: ${runError}`,
        });
      }

      const value = evaluated.result?.value as AxeRunResult | undefined;
      if (!value || !Array.isArray(value.violations)) {
        return cell("no-payload", {
          message: "axe.run() returned no violations array",
        });
      }
      // Belt and braces for a redirect between the location probe and
      // axe.run(): axe records the document URL it actually ran against.
      const ranAt = value.url && redirectTarget(url, value.url);
      if (ranAt) {
        return cell("redirected", {
          message: `axe ran at ${ranAt}, not the requested page — discarded`,
        });
      }
      return cell("ok", { result: value });
    } catch (e) {
      return cell("error", {
        message: `CDP failure: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  })();

  const timedOut = Symbol("timeout");
  const outcome = await Promise.race([
    run,
    sleep(config.timeout).then(() => timedOut),
  ]);

  let result: AxeCell;
  if (outcome !== timedOut) {
    result = outcome as AxeCell;
  } else {
    // Stop caring about this cell's load event, and take the page down so a
    // hung axe.run() can't bleed into the next cell.
    load.cancel();
    const reset = client.once("Page.loadEventFired");
    try {
      await client.send("Page.navigate", { url: "about:blank" });
      // Absorb the reset's own load event here (capped — the tab may be truly
      // wedged): the next cell registers its waiter before it navigates, and
      // an in-flight about:blank load would resolve that waiter early,
      // probing the next page mid-load.
      await Promise.race([reset.event, sleep(1000)]);
    } catch (_e) {
      // if even that fails the next cell will report the real problem
    }
    reset.cancel();
    result = cell("timeout", {
      message: `cell exceeded --timeout of ${config.timeout}ms`,
    });
  }

  if (seedId) {
    try {
      await client.send("Page.removeScriptToEvaluateOnNewDocument", {
        identifier: seedId,
      });
    } catch (_e) {
      // a stale seed runs before the next cell's own, which then overwrites it
    }
  }
  return result;
}

/**
 * Filesystem-safe slug per page, for cell artifact names.
 *
 * `/` maps to `_`, so `docs/index.html` and `docs_index.html` produce the
 * same slug — and the second page's cells would silently replace the first's
 * on disk. Slugs that collide get a short hash of the real path appended;
 * every other page keeps the pretty name.
 */
export function pageSlugs(pages: string[]): Map<string, string> {
  const rawSlug = (page: string) =>
    page.replace(/\.html$/, "").replace(/[\/\\]/g, "_") || "index";
  const counts = new Map<string, number>();
  for (const page of pages) {
    const slug = rawSlug(page);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  const slugs = new Map<string, string>();
  for (const page of pages) {
    const slug = rawSlug(page);
    slugs.set(
      page,
      counts.get(slug)! > 1
        ? `${slug}-${md5HashSync(page).slice(0, 6)}`
        : slug,
    );
  }
  return slugs;
}

/** Cell artifact name, e.g. `docs_index__1440x900__dark`. */
export function cellName(
  slug: string,
  viewport: string,
  mode: string,
): string {
  return `${slug}__${viewport}__${mode}`;
}

/**
 * Percent-encode a site-relative path for navigation, segment by segment. A
 * file name containing `#` or `?` would otherwise truncate the URL at parse
 * time: the cell scans the wrong page and fails on the 404 with a message
 * that points nowhere near the real cause.
 */
export function encodePagePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export interface AxeScanResult {
  cells: AxeCell[];
  /** axe-core version reported by the engine, once any cell has run. */
  axeVersion?: string;
}

/**
 * Run the page x viewport x mode matrix — each page contributes exactly its
 * discovered (and `--themes`-filtered) modes — writing each cell's raw payload
 * to `cellsDir` as it completes. `onCell` is called after each cell so the
 * caller can report progress.
 */
export async function runAxeScan(
  client: CdpClient,
  config: AxeScanConfig,
  baseUrl: string,
  pages: AxePage[],
  cellsDir: string,
  onCell?: (cell: AxeCell) => void,
): Promise<AxeScanResult> {
  const axeSource = Deno.readTextFileSync(vendoredAxePath());
  const slugs = pageSlugs(pages.map((page) => page.path));

  await client.send("Runtime.enable");
  await client.send("Page.enable");

  const cells: AxeCell[] = [];
  let axeVersion: string | undefined;
  for (const page of pages) {
    for (const viewport of config.viewports) {
      for (const mode of page.modes) {
        const url = `${baseUrl}/${encodePagePath(page.path)}`;
        const cell = await scanCell(
          client,
          axeSource,
          config,
          page,
          viewport,
          mode,
          url,
        );
        axeVersion = axeVersion ?? cell.result?.testEngine?.version;
        Deno.writeTextFileSync(
          join(
            cellsDir,
            `${cellName(slugs.get(page.path)!, viewport.label, mode)}.json`,
          ),
          JSON.stringify(cell, null, 2),
        );
        cells.push(cell);
        onCell?.(cell);
      }
    }
  }
  return { cells, axeVersion };
}
