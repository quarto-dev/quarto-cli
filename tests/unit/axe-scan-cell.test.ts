/*
 * axe-scan-cell.test.ts
 *
 * The transport half of fail-closed in `quarto call axe`'s scanCell: a
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
  cellName,
  encodePagePath,
  pageSlugs,
  redirectTarget,
  scanCell,
} from "../../src/command/call/axe/scan.ts";
import { axeScanConfig } from "../../src/command/call/axe/config.ts";
import { AxePage } from "../../src/command/call/axe/discover.ts";

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

unitTest(
  "scanCell - a wedged transport still finishes the cell",
  async () => {
    // The harder case behind the one above: not a slow page, but a connection
    // where nothing comes back — including the recovery navigation. Left
    // unbounded that send never returns, and the scan stops finishing cells
    // altogether, which is the one thing --timeout exists to prevent.
    const client = stubClient(() => new Promise(() => {}));
    const started = Date.now();
    const cell = await scanCell(
      client,
      "/* axe source */",
      axeScanConfig({ timeout: 200 }, "_site"),
      kPage,
      kViewport,
      "default",
      "http://127.0.0.1:9999/index.html",
    );
    const elapsed = Date.now() - started;
    assertEquals(cell.status, "timeout");
    // --timeout, then the capped recovery: bounded, not merely "eventually"
    assert(elapsed < 5000, `recovery was not bounded: ${elapsed}ms`);
  },
);

unitTest(
  "scanCell - an abandoned cell stops sending instead of running on",
  async () => {
    // A timed-out cell is abandoned, not stopped: whatever round-trip it was
    // awaiting still completes, and its next step would run against the page
    // the *following* cell just navigated to — a stale Runtime.evaluate
    // injecting axe and starting a second scan underneath it.
    const sent: string[] = [];
    const client = stubClient((method) => {
      sent.push(method);
      return new Promise((resolve) => setTimeout(() => resolve({}), 100));
    }, true);
    const cell = await scanCell(
      client,
      "/* axe source */",
      // 250ms leaves the cell mid-chain when the budget runs out
      axeScanConfig({ timeout: 250 }, "_site"),
      kPage,
      kViewport,
      "default",
      "http://127.0.0.1:9999/index.html",
    );
    assertEquals(cell.status, "timeout");
    // long enough for the abandoned run's in-flight send to land and its next
    // step to be attempted
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert(
      !sent.includes("Runtime.evaluate"),
      `the abandoned run kept going: ${sent.join(", ")}`,
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
    // a relative document URL resolves against the request before comparing
    assertEquals(redirectTarget(requested, "/blog/index.html"), undefined);
    assertEquals(
      redirectTarget(requested, "/index.html"),
      "/index.html",
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
        if (expression.includes("document.fonts")) {
          // the readiness probe: the page reports ready
          return Promise.resolve({ result: { value: true } });
        }
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

// ---------------------------------------------------------------------------
// Cell artifact naming and navigation URLs
// ---------------------------------------------------------------------------

unitTest(
  "cell naming - slugs that collide get a hash suffix, others stay pretty",
  // deno-lint-ignore require-await
  async () => {
    // `/` maps to `_`, so these two distinct pages share a raw slug — without
    // disambiguation the second page's cells silently replace the first's.
    const collided = pageSlugs(["docs/index.html", "docs_index.html"]);
    const slugA = collided.get("docs/index.html")!;
    const slugB = collided.get("docs_index.html")!;
    assert(slugA !== slugB, `collision survived: ${slugA}`);
    assert(slugA.startsWith("docs_index-"), slugA);
    assert(slugB.startsWith("docs_index-"), slugB);

    // No collision: the pretty, hash-free names are kept.
    const plain = pageSlugs(["index.html", "docs/index.html"]);
    assertEquals(plain.get("index.html"), "index");
    assertEquals(plain.get("docs/index.html"), "docs_index");

    assertEquals(cellName("docs_index", "1440x900", "dark"),
      "docs_index__1440x900__dark");
  },
);

unitTest(
  "navigation - page paths are percent-encoded segment by segment",
  // deno-lint-ignore require-await
  async () => {
    // `#` and `?` would truncate the URL at parse time: the cell would scan
    // the wrong page and fail on the 404 with a misleading message.
    assertEquals(encodePagePath("notes#1.html"), "notes%231.html");
    assertEquals(encodePagePath("a b/q?.html"), "a%20b/q%3F.html");
    // separators survive; plain paths are untouched
    assertEquals(encodePagePath("docs/index.html"), "docs/index.html");
  },
);
