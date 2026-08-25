/*
 * scan.ts
 *
 * The scan stage of `quarto dev-call axe`: drives headless Chrome over raw CDP
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

import { dirname, join } from "../../../deno_ral/path.ts";
import { debug } from "../../../deno_ral/log.ts";
import { sleep } from "../../../core/async.ts";
import { formatResourcePath } from "../../../core/resources.ts";
import { getBrowserExecutablePath } from "../../../core/puppeteer.ts";
import { onCleanup } from "../../../core/cleanup.ts";
import { getenv } from "../../../core/env.ts";
import { safeRemoveDirSync } from "../../../deno_ral/fs.ts";
import { AxeScanConfig, AxeViewport } from "./config.ts";
import { AxeMode, AxePage } from "./discover.ts";

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

      // Let webfonts, deferred scripts and any client-side layout settle before
      // axe reads computed style.
      await sleep(config.settle);

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
    try {
      await client.send("Page.navigate", { url: "about:blank" });
    } catch (_e) {
      // if even that fails the next cell will report the real problem
    }
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

/** Filesystem-safe cell name, e.g. `docs_index__1440x900__dark`. */
export function cellName(
  page: string,
  viewport: string,
  mode: string,
): string {
  const slug = page.replace(/\.html$/, "").replace(/[\/\\]/g, "_") || "index";
  return `${slug}__${viewport}__${mode}`;
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

  await client.send("Runtime.enable");
  await client.send("Page.enable");

  const cells: AxeCell[] = [];
  let axeVersion: string | undefined;
  for (const page of pages) {
    for (const viewport of config.viewports) {
      for (const mode of page.modes) {
        const url = `${baseUrl}/${page.path}`;
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
          join(cellsDir, `${cellName(page.path, viewport.label, mode)}.json`),
          JSON.stringify(cell, null, 2),
        );
        cells.push(cell);
        onCell?.(cell);
      }
    }
  }
  return { cells, axeVersion };
}
