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
import { CdpClient, scanCell } from "../../src/command/dev-call/axe/scan.ts";
import { axeScanConfig } from "../../src/command/dev-call/axe/config.ts";
import { AxePage } from "../../src/command/dev-call/axe/discover.ts";

const kPage: AxePage = {
  path: "index.html",
  modes: ["default"],
  darkColoured: false,
};
const kViewport = { width: 1440, height: 900, label: "1440x900" };

/**
 * A CdpClient whose `send` is scripted per test. `once` returns a
 * never-resolving event with a no-op cancel — the load event only matters on
 * paths these tests don't reach.
 */
function stubClient(
  send: (method: string) => Promise<unknown>,
): CdpClient {
  return {
    send,
    once: () => ({ event: new Promise(() => {}), cancel: () => {} }),
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
