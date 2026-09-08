/*
 * launch.ts
 *
 * The one place quarto's CDP drivers start headless Chrome.
 *
 * Two subsystems drive Chrome over CDP: `criClient` (src/core/cri/cri.ts,
 * which renders mermaid diagrams) and the axe scanner
 * (src/command/call/axe/scan.ts). They send entirely different commands, but
 * they start the browser the same way — and the launch half is where the
 * hard-won detail lives: which headless mode, how to tell the CDP endpoint is
 * up, and how not to orphan a process that never exits on its own.
 *
 * Not to be confused with the launch path in src/core/puppeteer.ts
 * (`withHeadlessBrowser`, reached through `withPuppeteerBrowserAndPage` and
 * `inPuppeteer`), which starts Chrome through puppeteer rather than over CDP.
 * Nothing outside that file enters it today, but it is a second launch path.
 *
 * Everything the two callers genuinely disagree about is passed in
 * (`--renderer-process-limit=1` for mermaid; `--hide-scrollbars` and a
 * throwaway profile for the scanner). Browser *discovery* is shared upstream
 * of here, in getBrowserExecutablePath() (src/core/puppeteer.ts).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { dirname } from "../../deno_ral/path.ts";
import { debug } from "../../deno_ral/log.ts";
import { safeRemoveDirSync } from "../../deno_ral/fs.ts";
import { getBrowserExecutablePath } from "../puppeteer.ts";
import { getenv } from "../env.ts";
import { findOpenPort } from "../port.ts";
import { sleep } from "../async.ts";
import {
  registerForExitCleanup,
  unregisterForExitCleanup,
} from "../process.ts";

export interface ChromeLaunchOptions {
  /**
   * Chrome/Chromium executable. Discovered with `getBrowserExecutablePath()`
   * when omitted — which throws its own (already-reported) error if there is
   * no browser to launch.
   */
  appPath?: string;
  /** CDP port. An open port at or above 9222 when omitted. */
  port?: number;
  /** Caller-specific flags, appended after the shared set. */
  args?: string[];
  /** Positional URL Chrome opens with, e.g. `about:blank`. */
  url?: string;
  /**
   * Launch into a throwaway `--user-data-dir`, removed when the browser
   * closes, so the browser cannot attach to — or be short-circuited by — a
   * Chrome the user already has running.
   */
  isolatedProfile?: boolean;
  /**
   * Wait for an actual page target (one with `webSocketDebuggerUrl`), not
   * just an HTTP 200 from `/json/list`. deno-cri's default target creates a
   * page itself when connecting with a string or object target, but the axe
   * scanner connects with a bare function target, which skips that — so it
   * needs the launcher to guarantee a target exists first.
   */
  awaitPageTarget?: boolean;
  /** How long to wait for the CDP endpoint, in ms. */
  timeout?: number;
  /** Tag for Chrome's stderr in the debug log. */
  logPrefix?: string;
}

export interface LaunchedChrome {
  /** The port the CDP endpoint is listening on. */
  port: number;
  /** The tail of Chrome's stderr: the explanation when something goes wrong. */
  stderrTail: () => string;
  /** Kill the browser, wait for it to go, and remove a throwaway profile. */
  close: () => Promise<void>;
}

/** How long the CDP endpoint gets to come up, when the caller doesn't say. */
const kDefaultLaunchTimeout = 15000;

/** How long a single readiness fetch gets before it's treated as a failed attempt. */
const kProbeAttemptTimeout = 1000;

function hasPageTarget(list: unknown): boolean {
  return Array.isArray(list) && list.some((t) =>
    typeof (t as { webSocketDebuggerUrl?: unknown })?.webSocketDebuggerUrl ===
      "string"
  );
}

/**
 * Poll the CDP endpoint until it answers `isReady`, and race that against
 * `exited`: a Chrome that has already died is never going to open the
 * endpoint no matter how long is left on the clock, so this reports the
 * moment it exits rather than waiting out the full timeout.
 *
 * The deadline is tracked in wall-clock time, not iterations — a `fetch()`
 * against a port nothing is listening on can itself take far longer than one
 * `interval`, and an iteration count would let that alone blow the budget.
 * Each attempt is capped at `kProbeAttemptTimeout` for the same reason.
 *
 * `localhost` rather than `127.0.0.1` because that is what deno-cri connects
 * to afterwards (its `defaults.HOST`) — a launcher that accepts a host the
 * client can't reach would report ready too early.
 */
async function waitForCdpEndpoint(
  port: number,
  timeout: number,
  exited: Promise<Deno.CommandStatus>,
  isReady: (list: unknown) => boolean,
): Promise<string | undefined> {
  const interval = 50;
  const deadline = Date.now() + timeout;
  let dead: Deno.CommandStatus | undefined;
  exited.then((status) => {
    dead = status;
  }).catch(() => {});

  let lastError = "no response";
  while (Date.now() < deadline) {
    if (dead) {
      return `Chrome exited (code ${dead.code}) before its CDP endpoint ` +
        `on port ${port} became ready`;
    }
    try {
      const response = await fetch(`http://localhost:${port}/json/list`, {
        signal: AbortSignal.timeout(kProbeAttemptTimeout),
      });
      const body = await response.json().catch(() => undefined);
      if (response.ok && isReady(body)) {
        return undefined;
      }
      lastError = response.ok
        ? "CDP endpoint has no ready page target yet"
        : `CDP endpoint returned ${response.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await sleep(interval);
  }
  return `Timed out waiting for headless Chrome on port ${port} (${lastError})`;
}

/**
 * Retry connecting a CDP client against `port`. Connecting the instant the
 * CDP endpoint answers is racy — cri.ts measured the failure rate against
 * the gap between tries and settled on 100ms, which is what this retries
 * with:
 *
 * sleep(0) caused 42/100 crashes
 * sleep(1) caused 42/100 crashes
 * sleep(2) caused 15/100 crashes
 * sleep(3) caused 13/100 crashes
 * sleep(4) caused 8/100 crashes
 * sleep(5) caused 1/100 crashes
 * sleep(6) caused 1/100 crashes
 * sleep(7) caused 1/100 crashes
 * sleep(8) caused 1/100 crashes
 * sleep(9) caused 0/100 crashes
 * sleep(10) caused 0/100 crashes
 * sleep(11) caused 0/100 crashes
 * sleep(12) caused 0/100 crashes
 * sleep(13) caused 1/100 crashes
 * sleep(14) caused 1/100 crashes
 * sleep(15) caused 0/100 crashes
 * sleep(16) caused 0/100 crashes
 * sleep(17) caused 0/100 crashes
 *
 * https://carlos-scheidegger.quarto.pub/failure-rates-in-cri-initialization/
 * suggests that 44ms is a good value. We use 100ms to try and account for
 * slower machines.
 */
export async function connectCdp<T>(
  port: number,
  connect: (port: number) => Promise<T>,
): Promise<T> {
  const maxTries = 5;
  for (let attempt = 1;; ++attempt) {
    try {
      return await connect(port);
    } catch (e) {
      if (attempt === maxTries) {
        throw new Error(
          `Failed to connect to CDP on port ${port}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
      await sleep(100);
    }
  }
}

/**
 * Launch headless Chrome with its CDP endpoint open on `port`, and return once
 * that endpoint answers. The caller connects a protocol client of its own —
 * this owns the process, not the conversation.
 */
export async function launchChrome(
  options: ChromeLaunchOptions = {},
): Promise<LaunchedChrome> {
  const port = options.port ?? findOpenPort(9222);
  const app = options.appPath ?? await getBrowserExecutablePath();
  const prefix = options.logPrefix ?? "chrome";

  const userDataDir = options.isolatedProfile
    ? Deno.makeTempDirSync({ prefix: "quarto-chrome" })
    : undefined;

  // Allow to adapt the headless mode depending on the Chrome version
  const headlessMode = getenv("QUARTO_CHROMIUM_HEADLESS_MODE", "none");

  const args = [
    // TODO: Chrome v128 changed the default from --headless=old to --headless=new
    // in 2024-08. Old headless mode was effectively a separate browser render,
    // and while more performant did not share the same browser implementation as
    // headful Chrome. New headless mode will likely be useful to some, but in Quarto use cases
    // like printing to PDF or screenshoting, we need more work to
    // move to the new mode. We'll use `--headless=old` as the default for now
    // until the new mode is more stable, or until we really pin a version as default to be used.
    // This is also impacting in chromote and pagedown R packages and we could keep syncing with them.
    // EDIT: 17/01/2025 - old mode is gone in Chrome 132. Let's default to new mode to unbreak things.
    // Best course of action is to pin a version of Chrome and use the chrome-headless-shell more adapted to our need.
    // ref: https://developer.chrome.com/blog/chrome-headless-shell
    `--headless${headlessMode == "none" ? "" : "=" + headlessMode}`,
    "--no-sandbox",
    "--disable-gpu",
    ...(userDataDir ? [`--user-data-dir=${userDataDir}`] : []),
    `--remote-debugging-port=${port}`,
    ...(options.args ?? []),
    ...(options.url ? [options.url] : []),
  ];

  const process = new Deno.Command(app, {
    args,
    // stdout is never read; piping it only risks blocking Chrome on a full pipe
    stdout: "null",
    stderr: "piped",
  }).spawn();

  // Register for cleanup inside exitWithCleanup() in case something goes wrong
  const cleanupId = registerForExitCleanup(process);

  // Chrome is chatty on stderr, and an unread pipe eventually blocks it. Drain
  // it to the debug log, keeping the tail around to explain a failed launch.
  let stderrTail = "";
  const draining = (async () => {
    const stream = process.stderr.pipeThrough(new TextDecoderStream());
    for await (const chunk of stream) {
      debug(`[${prefix}] ${chunk.trimEnd()}`);
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
      // Chromium headless won't terminate on its own, so we need to send a
      // kill signal
      process.kill();
    } catch (_e) {
      // already gone
    }
  };

  const close = async () => {
    kill();
    // Chrome rewrites its profile as it shuts down, so a throwaway dir can
    // only be removed once the process is really gone.
    await process.status;
    await draining.catch(() => {});
    unregisterForExitCleanup(cleanupId);
    if (userDataDir) {
      try {
        safeRemoveDirSync(userDataDir, dirname(userDataDir));
      } catch (_e) {
        // a leftover temp dir is not worth failing the caller over
      }
    }
  };

  const failure = await waitForCdpEndpoint(
    port,
    options.timeout ?? kDefaultLaunchTimeout,
    process.status,
    options.awaitPageTarget ? hasPageTarget : Array.isArray,
  );
  if (failure !== undefined) {
    debug(`[${prefix} path] : ${app}`);
    debug(`[${prefix} args] : ${args.join(" ")}`);
    await close();
    const detail = stderrTail.trim();
    throw new Error(failure + (detail ? `\nChrome said: ${detail}` : ""));
  }

  return {
    port,
    stderrTail: () => stderrTail,
    close,
  };
}
