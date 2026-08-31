/*
 * axe-transport-failclosed.test.ts
 *
 * The transport half of fail-closed, against a real browser.
 *
 * tests/unit/axe-scan-cell.test.ts covers what scanCell *does* with a rejected
 * send, using a stubbed client. This covers the half a stub cannot: that a real
 * CdpClient rejects at all when the connection goes away. The client sits on
 * the vendored deno-cri, which notices a dropped socket and then leaves every
 * command that was in flight unsettled forever — rejecting them is CdpClient's
 * own contribution, and it is what stops one crashed tab from hanging a whole
 * scan (llm-docs/axe-scan-architecture.md, "The scan stage").
 *
 * A hang is the failure this guards against, so every wait here has a deadline
 * and blowing it is reported as a distinct outcome, never as a pass.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { ExecuteOutput, test, Verify } from "../../test.ts";
import { findOpenPort } from "../../../src/core/port.ts";
import {
  launchScanBrowser,
  ScanBrowser,
} from "../../../src/command/call/axe/scan.ts";

/** What a dropped connection must reject with, whoever noticed it. */
const kClosed = "CDP connection closed";

/** Generous next to the sub-second reality: this is a hang detector. */
const kDeadline = 15000;

/**
 * A command the browser can never answer, so the only way it settles is the
 * connection going away.
 */
function unanswerable(browser: ScanBrowser): Promise<unknown> {
  return browser.client.send("Runtime.evaluate", {
    expression: "new Promise(function () {})",
    awaitPromise: true,
  });
}

/**
 * How `p` settled, as a string: the rejection message, `resolved`, or a
 * distinct `hung` — so a transport that never settles fails the assertion
 * rather than passing it.
 */
async function settled(p: Promise<unknown>): Promise<string> {
  let timer: number | undefined;
  try {
    await Promise.race([
      p,
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`hung: nothing settled within ${kDeadline}ms`)),
          kDeadline,
        );
      }),
    ]);
    return "resolved";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  } finally {
    clearTimeout(timer);
  }
}

const outcomes: Record<string, string> = {};

const rejects = (key: string, name: string): Verify => ({
  name,
  verify: (_output: ExecuteOutput[]) => {
    assertEquals(outcomes[key], kClosed);
    return Promise.resolve();
  },
});

test({
  name: "quarto call axe (transport: a lost connection rejects, never hangs)",
  type: "smoke",
  context: {
    // Two browsers are launched and both are gone by the end; the deadline
    // above is the real guard, so give the whole test room for two launches.
    timeout: 300000,
  },
  execute: async () => {
    // 1. We close the client ourselves while a command is outstanding.
    {
      const browser = await launchScanBrowser(findOpenPort(9222));
      try {
        await browser.client.send("Runtime.enable");
        const inFlight = unanswerable(browser);
        browser.client.close();
        outcomes["close"] = await settled(inFlight);
        outcomes["after-close"] = await settled(
          browser.client.send("Runtime.enable"),
        );
      } finally {
        await browser.close();
      }
    }

    // 2. The browser goes away underneath us — the case deno-cri notices but
    //    does not act on. Browser.close is the portable stand-in for the tab
    //    or the process dying: the socket drops from the far end.
    {
      const browser = await launchScanBrowser(findOpenPort(9222));
      try {
        await browser.client.send("Runtime.enable");
        const inFlight = unanswerable(browser);
        // this one dies with the browser too; it is the trigger, not a result
        browser.client.send("Browser.close").catch(() => {});
        outcomes["dropped"] = await settled(inFlight);
      } finally {
        await browser.close();
      }
    }
  },
  verify: [
    rejects("close", "close() rejects the command that was in flight"),
    rejects("after-close", "a send after close rejects instead of waiting"),
    rejects("dropped", "a dropped connection rejects the command in flight"),
  ],
});
