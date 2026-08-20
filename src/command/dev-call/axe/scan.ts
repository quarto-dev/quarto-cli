/*
 * scan.ts
 *
 * The scan stage of `quarto dev-call axe`: drives headless Chrome over raw CDP
 * and runs quarto-cli's vendored axe-core against every page x viewport x theme
 * cell of an already-rendered site.
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

import { dirname, join } from "../../../deno_ral/path.ts";
import { debug } from "../../../deno_ral/log.ts";
import { sleep } from "../../../core/async.ts";
import { formatResourcePath } from "../../../core/resources.ts";
import { getBrowserExecutablePath } from "../../../core/puppeteer.ts";
import { onCleanup } from "../../../core/cleanup.ts";
import { getenv } from "../../../core/env.ts";
import { safeRemoveDirSync } from "../../../deno_ral/fs.ts";
import { AxeScanConfig, AxeTheme, AxeViewport } from "./config.ts";

/** Status of a single scanned cell. Anything but "ok" fails closed. */
export type AxeCellStatus = "ok" | "timeout" | "error" | "no-payload";

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

/**
 * How the page was put into the requested colour scheme.
 *
 * - `emulated` — `prefers-color-scheme` was enough, either because the page has
 *   no Quarto colour-scheme machinery to select, or because it already matched.
 * - `toggled` — Quarto's toggle had to be clicked, which is the normal case: a
 *   site with `light:`/`dark:` themes ignores `prefers-color-scheme` unless
 *   `respect-user-color-scheme` is set.
 * - `unreachable` — the page ships a dark theme but the scanner could not select
 *   it (no toggle rendered on this page). The cell is really the other theme, so
 *   it must not read as coverage of this one.
 * - `assumed-identical` — the page offers no Quarto dark theme to select, so an
 *   already-scanned sibling cell's payload was reused instead of running axe
 *   again. An assumption, not a proof: see `hasSelectableDarkTheme`.
 */
export type AxeColorSchemeMechanism =
  | "emulated"
  | "toggled"
  | "unreachable"
  | "assumed-identical";

/** One page x viewport x theme cell: the unit of scanning and of fail-closed. */
export interface AxeCell {
  page: string;
  viewport: string;
  theme: AxeTheme;
  url: string;
  status: AxeCellStatus;
  /** How the requested theme was reached. */
  colorScheme?: AxeColorSchemeMechanism;
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

interface CdpMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Minimal Chrome DevTools Protocol client: send a command, await its result,
 * and wait for a named event. Everything the scanner needs is six methods, so
 * there is deliberately no wrapper library here (see the design note).
 */
export class CdpClient {
  private nextId = 0;
  private pending = new Map<
    number,
    { resolve: (result: unknown) => void; reject: (err: Error) => void }
  >();
  private listeners = new Map<
    string,
    Set<(params: Record<string, unknown>) => void>
  >();
  private closed = false;

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener("message", (ev: MessageEvent) => {
      this.onMessage(ev.data as string);
    });
    ws.addEventListener("close", () => {
      this.closed = true;
      this.rejectPending(new Error("CDP connection closed"));
    });
  }

  static connect(wsUrl: string): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.addEventListener("open", () => resolve(new CdpClient(ws)), {
        once: true,
      });
      ws.addEventListener(
        "error",
        () => reject(new Error(`Failed to connect to CDP at ${wsUrl}`)),
        { once: true },
      );
    });
  }

  send<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    if (this.closed) {
      return Promise.reject(new Error("CDP connection closed"));
    }
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
      });
      this.ws.send(JSON.stringify({ id, method, params }));
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
    let handler: (params: Record<string, unknown>) => void = () => {};
    const event = new Promise<Record<string, unknown>>((resolve) => {
      handler = (params) => {
        this.off(method, handler);
        resolve(params);
      };
      this.on(method, handler);
    });
    return { event, cancel: () => this.off(method, handler) };
  }

  close() {
    if (!this.closed) {
      this.closed = true;
      try {
        this.ws.close();
      } catch (_e) {
        // the socket is going away regardless
      }
      this.rejectPending(new Error("CDP connection closed"));
    }
  }

  private on(
    method: string,
    handler: (params: Record<string, unknown>) => void,
  ) {
    let handlers = this.listeners.get(method);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(method, handlers);
    }
    handlers.add(handler);
  }

  private off(
    method: string,
    handler: (params: Record<string, unknown>) => void,
  ) {
    this.listeners.get(method)?.delete(handler);
  }

  private onMessage(data: string) {
    let msg: CdpMessage;
    try {
      msg = JSON.parse(data);
    } catch (_e) {
      debug(`[axe] unparseable CDP message: ${data.slice(0, 200)}`);
      return;
    }
    if (msg.id !== undefined) {
      const entry = this.pending.get(msg.id);
      if (entry) {
        this.pending.delete(msg.id);
        if (msg.error) {
          entry.reject(
            new Error(`CDP error ${msg.error.code}: ${msg.error.message}`),
          );
        } else {
          entry.resolve(msg.result);
        }
      }
      return;
    }
    if (msg.method) {
      for (const handler of this.listeners.get(msg.method) ?? []) {
        handler(msg.params ?? {});
      }
    }
  }

  private rejectPending(err: Error) {
    for (const entry of this.pending.values()) {
      entry.reject(err);
    }
    this.pending.clear();
  }
}

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------

export interface ScanBrowser {
  client: CdpClient;
  close: () => Promise<void>;
}

interface CdpTarget {
  type: string;
  webSocketDebuggerUrl?: string;
}

async function waitForCdp(
  port: number,
  timeout: number,
): Promise<string> {
  const interval = 50;
  let waited = 0;
  let lastError = "no CDP page target";
  while (waited < timeout) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = (await response.json()) as CdpTarget[];
        const page = targets.find((target) =>
          target.type === "page" && target.webSocketDebuggerUrl
        );
        if (page?.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      } else {
        // drain the body so the connection can be reused
        await response.body?.cancel();
        lastError = `CDP endpoint returned ${response.status}`;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await sleep(interval);
    waited += interval;
  }
  throw new Error(
    `Timed out waiting for headless Chrome on port ${port} (${lastError}).`,
  );
}

/**
 * Launch headless Chrome on its own CDP port and connect to its page target.
 * The browser gets a throwaway user-data-dir so it can't attach to (or be
 * short-circuited by) a Chrome the user already has running.
 */
export async function launchScanBrowser(port: number): Promise<ScanBrowser> {
  const executable = await getBrowserExecutablePath();
  const userDataDir = Deno.makeTempDirSync({ prefix: "quarto-axe-chrome" });

  // Same headless-mode escape hatch as src/core/cri/cri.ts.
  const headlessMode = getenv("QUARTO_CHROMIUM_HEADLESS_MODE", "none");
  const command = new Deno.Command(executable, {
    args: [
      `--headless${headlessMode === "none" ? "" : "=" + headlessMode}`,
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${port}`,
      "about:blank",
    ],
    stdout: "null",
    stderr: "piped",
  });
  const process = command.spawn();

  // Chrome is chatty on stderr, and an unread pipe eventually blocks it. Drain
  // it to the debug log, keeping the tail around to explain a failed launch.
  let stderrTail = "";
  const draining = (async () => {
    const stream = process.stderr.pipeThrough(new TextDecoderStream());
    for await (const chunk of stream) {
      debug(`[axe chrome] ${chunk.trimEnd()}`);
      stderrTail = (stderrTail + chunk).slice(-2000);
    }
  })();

  let killed = false;
  const kill = () => {
    if (killed) {
      return;
    }
    killed = true;
    try {
      process.kill();
    } catch (_e) {
      // already gone
    }
  };
  // Chrome will not terminate on its own, and Ctrl-C must not orphan it. The
  // profile dir is left behind on that path: removing it means waiting for the
  // process to exit, and cleanup handlers are synchronous.
  onCleanup(kill);

  // Chrome rewrites its profile as it shuts down, so the dir can only be
  // removed once the process is really gone.
  const shutdown = async () => {
    kill();
    await process.status;
    await draining.catch(() => {});
    try {
      safeRemoveDirSync(userDataDir, dirname(userDataDir));
    } catch (_e) {
      // a leftover temp dir is not worth failing the scan over
    }
  };

  let client: CdpClient;
  try {
    const wsUrl = await waitForCdp(port, 15000);
    client = await CdpClient.connect(wsUrl);
  } catch (e) {
    await shutdown();
    const detail = stderrTail.trim();
    throw new Error(
      (e instanceof Error ? e.message : String(e)) +
        (detail ? `\nChrome said: ${detail}` : ""),
    );
  }

  return {
    client,
    close: async () => {
      client.close();
      await shutdown();
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
 * Read the page's active colour scheme.
 *
 * `supported` is false when there is no Quarto dark stylesheet to select, which
 * covers single-theme sites and hand-written pages — there, `prefers-color-scheme`
 * emulation is all there is, and it is already applied.
 *
 * The active mode is read from whether the `data-mode="dark"` stylesheet is
 * enabled, not from `localStorage` or the toggle's own state: it is the thing
 * that actually decides what the user sees, and it is correct whether the mode
 * came from `respect-user-color-scheme`, from a click, or from the author's
 * default.
 */
const kColorSchemeProbe = `
(function () {
  var dark = document.querySelector('link.quarto-color-scheme[data-mode="dark"]');
  if (!dark) {
    return { supported: false, active: null, hasToggle: false };
  }
  return {
    supported: true,
    active: dark.getAttribute("rel") === "stylesheet" ? "dark" : "light",
    hasToggle: !!document.querySelector(".quarto-color-scheme-toggle"),
  };
})()
`;

const kColorSchemeToggleClick = `
(function () {
  var toggle = document.querySelector(".quarto-color-scheme-toggle");
  if (!toggle) {
    return false;
  }
  toggle.click();
  return true;
})()
`;

/**
 * Does this page offer a Quarto dark theme to select?
 *
 * Used to decide whether a second theme cell can reuse the first's payload. The
 * question is deliberately narrow — one selector, no stylesheet inspection —
 * because on the sites this tool is for, a Quarto dark theme is the only thing
 * that makes a theme cell differ: a rendered Quarto site contains no
 * `prefers-color-scheme` at all (measured on both a single-theme and a
 * light+dark site; Bootstrap's `_color-mode.scss` mixins are compiled away, and
 * the only occurrence in the core template is the `matchMedia` read that
 * `respect-user-color-scheme` emits).
 *
 * **The assumption this makes, and where it is wrong.** A page with no Quarto
 * dark theme but with hand-written `@media (prefers-color-scheme: dark)` CSS
 * *does* have a dark presentation, and its dark-only findings will be missed.
 * Known instances: a custom `.scss` that rolls its own dark mode, and bslib's
 * web components (Quarto dashboards, value boxes), which carry
 * `prefers-color-scheme` rules inside shadow roots. Both are uncommon; neither
 * is impossible. `--themes dark` alone still scans such a page properly, since
 * there is then no sibling to reuse.
 *
 * The safer version — enumerate every stylesheet, including shadow roots, and
 * fail closed on anything unreadable — was built and removed as unjustified
 * complexity for v1. M5 is where we find out whether that was right.
 */
const kSelectableDarkThemeProbe = `
!!document.querySelector('link.quarto-color-scheme[data-mode]')
`;

/** True when a Quarto dark theme is present, or when the probe can't tell. */
async function hasSelectableDarkTheme(client: CdpClient): Promise<boolean> {
  const response = await client.send<RuntimeEvaluateResult>(
    "Runtime.evaluate",
    { expression: kSelectableDarkThemeProbe, returnByValue: true },
  );
  if (evaluateError(response)) {
    return true;
  }
  return response.result?.value !== false;
}

interface ColorSchemeState {
  supported: boolean;
  active: AxeTheme | null;
  hasToggle: boolean;
}

/**
 * Select the author's `theme` presentation, by whichever route this page offers.
 *
 * What the theme axis tests is the two themes the *author* ships, not the two
 * states a user's OS can be in. A given page offers one or both routes into a
 * theme, and they are not interchangeable:
 *
 * - Quarto's `light:`/`dark:` themes are selected by its colour-scheme toggle.
 *   That is the only route when `respect-user-color-scheme` is false, which is
 *   the default — so emulation alone would scan the light theme twice.
 * - Author CSS under `@media (prefers-color-scheme: dark)` is selected by
 *   emulation, and on a non-Quarto page emulation is the only route at all.
 *
 * So both are set, pointing at the same theme, and the result is read back
 * rather than assumed. That makes `respect-user-color-scheme` invisible here:
 * when it is true, emulation has already selected the theme and no click
 * happens.
 *
 * Called for every cell, not once per run. The toggle writes `localStorage` and
 * the whole scan is served from one origin, so a click in one cell would
 * otherwise leak into every later page load.
 */
async function alignColorScheme(
  client: CdpClient,
  theme: AxeTheme,
  settle: number,
): Promise<AxeColorSchemeMechanism> {
  const read = async (): Promise<ColorSchemeState | undefined> => {
    const response = await client.send<RuntimeEvaluateResult>(
      "Runtime.evaluate",
      { expression: kColorSchemeProbe, returnByValue: true },
    );
    if (evaluateError(response)) {
      return undefined;
    }
    return response.result?.value as ColorSchemeState | undefined;
  };

  const before = await read();
  // No Quarto dark stylesheet, or the probe failed: emulation is all we have.
  if (!before?.supported || before.active === theme) {
    return "emulated";
  }
  if (!before.hasToggle) {
    return "unreachable";
  }

  const clicked = await client.send<RuntimeEvaluateResult>("Runtime.evaluate", {
    expression: kColorSchemeToggleClick,
    returnByValue: true,
  });
  if (evaluateError(clicked) || clicked.result?.value !== true) {
    return "unreachable";
  }
  // The swap re-lays-out the page, so give it the same grace as the initial load.
  await sleep(settle);

  const after = await read();
  return after?.active === theme ? "toggled" : "unreachable";
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

async function scanCell(
  client: CdpClient,
  axeSource: string,
  config: AxeScanConfig,
  page: string,
  viewport: AxeViewport,
  theme: AxeTheme,
  url: string,
): Promise<AxeCell> {
  const started = Date.now();
  const cell = (
    status: AxeCellStatus,
    extra: Partial<AxeCell> = {},
  ): AxeCell => ({
    page,
    viewport: viewport.label,
    theme,
    url,
    status,
    elapsed: Date.now() - started,
    ...extra,
  });

  const load = client.once("Page.loadEventFired");
  const run = (async (): Promise<AxeCell> => {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: theme }],
    });

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

    // Let webfonts, deferred scripts and any client-side layout settle before
    // axe reads computed style.
    await sleep(config.settle);

    // Select the author's theme for this cell. Quarto's themes ignore
    // prefers-color-scheme by default, so emulation alone would scan the light
    // theme twice.
    const colorScheme = await alignColorScheme(client, theme, config.settle);

    const injected = await client.send<RuntimeEvaluateResult>(
      "Runtime.evaluate",
      { expression: axeSource, returnByValue: false },
    );
    const injectError = evaluateError(injected);
    if (injectError) {
      return cell("error", {
        colorScheme,
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
        colorScheme,
        message: `axe.run() failed: ${runError}`,
      });
    }

    const value = evaluated.result?.value as AxeRunResult | undefined;
    if (!value || !Array.isArray(value.violations)) {
      return cell("no-payload", {
        colorScheme,
        message: "axe.run() returned no violations array",
      });
    }
    return cell("ok", { colorScheme, result: value });
  })();

  const timedOut = Symbol("timeout");
  const outcome = await Promise.race([
    run,
    sleep(config.timeout).then(() => timedOut),
  ]);
  if (outcome !== timedOut) {
    return outcome as AxeCell;
  }

  // Stop caring about this cell's load event, and take the page down so a hung
  // axe.run() can't bleed into the next cell.
  load.cancel();
  try {
    await client.send("Page.navigate", { url: "about:blank" });
  } catch (_e) {
    // if even that fails the next cell will report the real problem
  }
  return cell("timeout", {
    message: `cell exceeded --timeout of ${config.timeout}ms`,
  });
}

/** Filesystem-safe cell name, e.g. `docs_index__1440x900__dark`. */
export function cellName(
  page: string,
  viewport: string,
  theme: string,
): string {
  const slug = page.replace(/\.html$/, "").replace(/[\/\\]/g, "_") || "index";
  return `${slug}__${viewport}__${theme}`;
}

export interface AxeScanResult {
  cells: AxeCell[];
  /** axe-core version reported by the engine, once any cell has run. */
  axeVersion?: string;
}

/**
 * Run the page x viewport x theme matrix, writing each cell's raw payload to
 * `cellsDir` as it completes. `onCell` is called after each cell so the caller
 * can report progress.
 */
export async function runAxeScan(
  client: CdpClient,
  config: AxeScanConfig,
  baseUrl: string,
  pages: string[],
  cellsDir: string,
  onCell?: (cell: AxeCell) => void,
): Promise<AxeScanResult> {
  const axeSource = Deno.readTextFileSync(vendoredAxePath());

  await client.send("Runtime.enable");
  await client.send("Page.enable");

  const cells: AxeCell[] = [];
  let axeVersion: string | undefined;
  for (const page of pages) {
    for (const viewport of config.viewports) {
      // Within one page x viewport, a later theme reuses an earlier one's
      // payload when the page has no Quarto dark theme to select. Reuse, never
      // omission: the cell stays in the matrix with a real result, so nothing
      // silently drops out of the accounting.
      let reusable: AxeCell | undefined;
      for (const theme of config.themes) {
        const url = `${baseUrl}/${page}`;
        let cell: AxeCell;
        if (reusable?.result) {
          cell = {
            ...reusable,
            theme,
            colorScheme: "assumed-identical",
            elapsed: 0,
          };
        } else {
          cell = await scanCell(
            client,
            axeSource,
            config,
            page,
            viewport,
            theme,
            url,
          );
          // Only a cell that really ran can be reused from.
          if (cell.status === "ok" && !await hasSelectableDarkTheme(client)) {
            reusable = cell;
          }
        }
        axeVersion = axeVersion ?? cell.result?.testEngine?.version;
        Deno.writeTextFileSync(
          join(cellsDir, `${cellName(page, viewport.label, theme)}.json`),
          JSON.stringify(cell, null, 2),
        );
        cells.push(cell);
        onCell?.(cell);
      }
    }
  }
  return { cells, axeVersion };
}
