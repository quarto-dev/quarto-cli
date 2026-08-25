/*
 * axe-scan-cell.test.ts
 *
 * The transport half of fail-closed in `quarto dev-call axe`'s scanCell: a
 * rejected CDP send — crashed tab, dropped WebSocket, protocol error — must
 * fail that one cell, never abort the scan. In-page failures (an axe error,
 * a mode mismatch) are covered end-to-end by the smoke tests; these tests
 * stub the CDP client, which is exactly the layer under test.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import {
  CdpClient,
  redirectTarget,
  scanCell,
} from "../../src/command/dev-call/axe/scan.ts";
import { axeScanConfig } from "../../src/command/dev-call/axe/config.ts";
import { AxePage } from "../../src/command/dev-call/axe/discover.ts";

const kPage: AxePage = {
  path: "index.html",
  modes: ["default"],
  darkColoured: false,
};
const kViewport = { width: 1440, height: 900, label: "1440x900" };

/**
 * A CdpClient whose `send` is scripted per test. By default `once` returns a
 * never-resolving load event with a no-op cancel; pass `loaded: true` for
 * paths that navigate past it.
 */
function stubClient(
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
  loaded = false,
): CdpClient {
  return {
    send,
    once: () => ({
      event: loaded ? Promise.resolve({}) : new Promise(() => {}),
      cancel: () => {},
    }),
  } as unknown as CdpClient;
}

unitTest(
  "scanCell - a rejected CDP send fails the cell closed, not the scan",
  async () => {
    const client = stubClient(() =>
      Promise.reject(new Error("tab crashed (Inspector.targetCrashed)"))
    );
    // Must resolve to a cell — a rejection here is the whole-scan abort this
    // test exists to prevent.
    const cell = await scanCell(
      client,
      "/* axe source */",
      axeScanConfig({}, "_site"),
      kPage,
      kViewport,
      "default",
      "http://127.0.0.1:9999/index.html",
    );
    assertEquals(cell.status, "error");
    assert(
      cell.message?.includes("CDP failure") &&
        cell.message?.includes("tab crashed"),
      `unexpected message: ${cell.message}`,
    );
  },
);

unitTest(
  "scanCell - a hung command still times out, and the reset is attempted",
  async () => {
    const sent: string[] = [];
    const client = stubClient((method) => {
      sent.push(method);
      // The reset navigation must complete so the timeout path can finish;
      // everything else hangs, like a wedged renderer.
      return method === "Page.navigate"
        ? Promise.resolve({})
        : new Promise(() => {});
    });
    const cell = await scanCell(
      client,
      "/* axe source */",
      axeScanConfig({ timeout: 200 }, "_site"),
      kPage,
      kViewport,
      "default",
      "http://127.0.0.1:9999/index.html",
    );
    assertEquals(cell.status, "timeout");
    assert(
      sent.includes("Page.navigate"),
      "the timeout path should navigate to about:blank to unwedge the tab",
    );
  },
);

// ---------------------------------------------------------------------------
// The redirect guard: axe must run on the page we asked for
// ---------------------------------------------------------------------------

unitTest(
  "redirectTarget - origin and path decide; search and hash do not",
  // deno-lint-ignore require-await
  async () => {
    const requested = "http://127.0.0.1:4173/blog/index.html";
    // stayed put, including reveal's history-API fragment rewrites
    assertEquals(redirectTarget(requested, requested), undefined);
    assertEquals(
      redirectTarget(requested, `${requested}#/3`),
      undefined,
    );
    assertEquals(
      redirectTarget(requested, `${requested}?q=x`),
      undefined,
    );
    // the positron-website case: a zero-delay meta refresh to an external host
    assertEquals(
      redirectTarget(requested, "https://opensource.posit.co/blog/q/positron/"),
      "https://opensource.posit.co/blog/q/positron/",
    );
    // a local redirect is still a different page
    assertEquals(
      redirectTarget(requested, "http://127.0.0.1:4173/index.html"),
      "http://127.0.0.1:4173/index.html",
    );
    // wherever an unparseable location is, it is not the requested page
    assertEquals(redirectTarget(requested, ""), "(unknown location)");
    assertEquals(redirectTarget(requested, "about:blank"), "about:blank");
  },
);

unitTest(
  "scanCell - a page that redirects during settle fails closed, unscanned",
  async () => {
    let axeInjected = false;
    const client = stubClient((method, params) => {
      if (method === "Runtime.evaluate") {
        const expression = String(params?.expression ?? "");
        if (expression.includes("location.href")) {
          return Promise.resolve({
            result: { value: "https://opensource.posit.co/blog/q/positron/" },
          });
        }
        axeInjected = true;
        return Promise.resolve({ result: {} });
      }
      return Promise.resolve({});
    }, true);
    const cell = await scanCell(
      client,
      "/* axe source */",
      axeScanConfig({ settle: 1 }, "_site"),
      kPage,
      kViewport,
      "default",
      "http://127.0.0.1:9999/blog/index.html",
    );
    assertEquals(cell.status, "redirected");
    assert(
      cell.message?.includes("opensource.posit.co"),
      `the destination should be named: ${cell.message}`,
    );
    assert(!axeInjected, "axe must not be injected into the destination");
  },
);
