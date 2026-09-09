/*
 * chrome-launch.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals, assertRejects } from "testing/asserts";
import { join } from "path";
import { connectCdp, hasPageTarget, launchChrome } from
  "../../src/core/cri/launch.ts";
import { findOpenPort } from "../../src/core/port.ts";
import { unitTest } from "../test.ts";
import { writeFakeExecutable } from "./chrome-launch-fixtures.ts";

/** Short enough that the test doesn't wait around, long enough to be real. */
const kLaunchTimeout = 300;
/** How long the fake Chrome stays up before giving up on its own. */
const kSelfDestructMs = 2000;

// A fake Chrome that accepts the TCP connection on its CDP port but never
// answers on it -- genuinely silent, not merely absent, so a `fetch()`
// against it hangs on the response rather than failing fast with connection
// refused.
async function writeSilentChromeExecutable(
  dir: string,
  port: number,
  stderrText: string,
  selfDestructMs: number = kSelfDestructMs,
  exitTimestampPath?: string,
): Promise<string> {
  return writeFakeExecutable(
    dir,
    "silent-chrome",
    [
      `const listener = Deno.listen({ port: ${port} });`,
      "(async () => {",
      "  for await (const _conn of listener) {",
      "    // accept the connection, never write a response",
      "  }",
      "})().catch(() => {});",
      stderrText
        ? `await Deno.stderr.write(new TextEncoder().encode(${
          JSON.stringify(stderrText)
        }));`
        : "",
      `setTimeout(() => {`,
      // Recorded synchronously, right at the moment of exit, so the test
      // can measure launchChrome's detection latency against the process's
      // own clock instead of wall time from before it was even spawned --
      // subprocess startup (a second or more on a loaded Windows host) would
      // otherwise swamp the narrow window this is meant to verify.
      exitTimestampPath
        ? `  Deno.writeTextFileSync(${
          JSON.stringify(exitTimestampPath)
        }, String(Date.now()));`
        : "",
      `  Deno.exit(1);`,
      `}, ${selfDestructMs});`,
    ],
    exitTimestampPath,
  );
}

unitTest(
  "chrome-launch - alive-but-silent Chrome rejects, stderr carried",
  async () => {
    const port = findOpenPort();
    const dir = await Deno.makeTempDir({ prefix: "chrome-launch-silent-" });
    try {
      const fakeChrome = await writeSilentChromeExecutable(
        dir,
        port,
        "Chrome blew up: missing shared library",
      );
      const err = await assertRejects(
        () =>
          launchChrome({ appPath: fakeChrome, port, timeout: kLaunchTimeout }),
        Error,
      );
      assert(
        err.message.includes(String(port)),
        `expected port ${port} named in: ${err.message}`,
      );
      assert(
        err.message.includes(
          "Chrome said: Chrome blew up: missing shared library",
        ),
        `expected stderr tail after "Chrome said:" in: ${err.message}`,
      );
    } finally {
      await Deno.remove(dir, { recursive: true }).catch(() => {});
    }
  },
);

unitTest(
  "chrome-launch - reports a Chrome exit promptly, not after the in-flight probe times out",
  async () => {
    const port = findOpenPort();
    const dir = await Deno.makeTempDir({ prefix: "chrome-launch-silent-" });
    try {
      // Self-destructs quickly, but the launch timeout is generous -- if
      // process exit were only checked between probes, the in-flight probe
      // against this genuinely silent port could run for up to a full
      // probeTimeoutMs (up to 1000ms) after the exit before it's noticed.
      const selfDestructMs = 200;
      const exitTimestampPath = join(dir, "exit-timestamp.txt");
      const fakeChrome = await writeSilentChromeExecutable(
        dir,
        port,
        "",
        selfDestructMs,
        exitTimestampPath,
      );
      const err = await assertRejects(
        () => launchChrome({ appPath: fakeChrome, port, timeout: 5000 }),
        Error,
      );
      // Measured from the child's own exit, not from before it was spawned --
      // subprocess startup time is irrelevant noise for what this test
      // verifies (that an in-flight probe is aborted promptly on exit,
      // rather than waiting out its own timeout).
      const exitTimestamp = Number(
        await Deno.readTextFile(exitTimestampPath),
      );
      const detectionLatency = Date.now() - exitTimestamp;
      assert(
        err.message.includes("Chrome exited"),
        `expected an exit message, got: ${err.message}`,
      );
      assert(
        detectionLatency < 500,
        `expected the exit to be detected within 500ms of the process ` +
          `actually exiting, took ${detectionLatency}ms`,
      );
    } finally {
      await Deno.remove(dir, { recursive: true }).catch(() => {});
    }
  },
);

// deno-lint-ignore require-await
unitTest(
  "chrome-launch - hasPageTarget requires target.type to be page",
  async () => {
    assertEquals(
      hasPageTarget([{ type: "page", webSocketDebuggerUrl: "ws://x" }]),
      true,
    );
    // A connectable target that isn't a page (e.g. a service worker) must not
    // count -- deno-cri's own defaultTarget (chrome.js) applies the same
    // type === "page" filter before falling back to any connectable target.
    assertEquals(
      hasPageTarget([{
        type: "service_worker",
        webSocketDebuggerUrl: "ws://x",
      }]),
      false,
    );
    assertEquals(hasPageTarget([]), false);
    assertEquals(hasPageTarget("not-an-array"), false);
  },
);

function countingConnector(failuresBeforeSuccess: number) {
  let attempts = 0;
  const connect = (_port: number) => {
    attempts++;
    if (attempts <= failuresBeforeSuccess) {
      return Promise.reject(new Error(`transient failure #${attempts}`));
    }
    return Promise.resolve(attempts);
  };
  return { connect, attemptsSoFar: () => attempts };
}

unitTest(
  "chrome-launch - connectCdp gives up after exactly 5 attempts",
  async () => {
    const { connect, attemptsSoFar } = countingConnector(Infinity);
    const err = await assertRejects(() => connectCdp(1, connect), Error);
    assertEquals(attemptsSoFar(), 5);
    assert(
      err.message.includes("1"),
      `expected port 1 named in: ${err.message}`,
    );
  },
);

unitTest(
  "chrome-launch - connectCdp succeeds after transient failures without exhausting retries",
  async () => {
    const { connect, attemptsSoFar } = countingConnector(2);
    const result = await connectCdp(1, connect);
    assertEquals(result, 3);
    assertEquals(attemptsSoFar(), 3);
  },
);

/**
 * A fake Chrome that serves `/json/list` itself, controlling exactly what the
 * launcher's readiness poll sees. `pageAfterMs` is measured from the fake
 * server's own start, not the caller's: `[]` until then, a single real page
 * target afterward. `undefined` means never.
 */
async function writeJsonListChromeExecutable(
  dir: string,
  port: number,
  pageAfterMs: number | undefined,
): Promise<string> {
  return writeFakeExecutable(dir, "json-list-chrome", [
    "const start = Date.now();",
    `const pageAfterMs = ${
      pageAfterMs === undefined ? "undefined" : pageAfterMs
    };`,
    `Deno.serve({ port: ${port}, onListen: () => {} }, (req) => {`,
    "  const url = new URL(req.url);",
    '  if (url.pathname !== "/json/list") {',
    '    return new Response("", { status: 404 });',
    "  }",
    "  const ready = pageAfterMs !== undefined &&",
    "    Date.now() - start >= pageAfterMs;",
    "  const body = ready",
    `    ? JSON.stringify([{ type: "page", webSocketDebuggerUrl: "ws://localhost:${port}/devtools/page/1" }])`,
    '    : "[]";',
    "  return new Response(body, { status: 200 });",
    "});",
    `setTimeout(() => Deno.exit(0), ${kSelfDestructMs});`,
  ]);
}

unitTest(
  "chrome-launch - awaitPageTarget rejects when the endpoint never reports a page target",
  async () => {
    const port = findOpenPort();
    const dir = await Deno.makeTempDir({ prefix: "chrome-launch-json-list-" });
    try {
      const fakeChrome = await writeJsonListChromeExecutable(
        dir,
        port,
        undefined,
      );
      await assertRejects(
        () =>
          launchChrome({
            appPath: fakeChrome,
            port,
            timeout: kLaunchTimeout,
            awaitPageTarget: true,
          }),
        Error,
      );
    } finally {
      await Deno.remove(dir, { recursive: true }).catch(() => {});
    }
  },
);

unitTest(
  "chrome-launch - awaitPageTarget resolves once a real page target appears",
  async () => {
    const port = findOpenPort();
    const dir = await Deno.makeTempDir({ prefix: "chrome-launch-json-list-" });
    try {
      const fakeChrome = await writeJsonListChromeExecutable(dir, port, 150);
      const browser = await launchChrome({
        appPath: fakeChrome,
        port,
        // Long enough to span several 50ms polls past the 150ms flip.
        timeout: 3000,
        awaitPageTarget: true,
      });
      await browser.close();
    } finally {
      await Deno.remove(dir, { recursive: true }).catch(() => {});
    }
  },
);
