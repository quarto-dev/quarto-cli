/*
 * chrome-launch.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals, assertRejects } from "testing/asserts";
import { join } from "path";
import {
  connectCdp,
  hasPageTarget,
  launchChrome,
  probeTimeoutMs,
} from "../../src/core/cri/launch.ts";
import { CdpClient } from "../../src/command/call/axe/scan.ts";
import { findOpenPort } from "../../src/core/port.ts";
import { unitTest } from "../test.ts";

/** Short enough that the test doesn't wait around, long enough to be real. */
const kLaunchTimeout = 300;
/** How long the fake Chrome stays up before giving up on its own. */
const kSelfDestructMs = 2000;

// A fake Chrome that accepts the TCP connection on its CDP port but never
// answers on it -- genuinely silent, not merely absent, so a `fetch()`
// against it hangs on the response rather than failing fast with connection
// refused. Same wrapper mechanism as chrome-launch-flags.test.ts's fake
// executable (.cmd on Windows, a shebang script on Unix, re-invoking the
// current deno binary to run an inline script -- a wrapper is needed because
// launchChrome() always prepends real Chrome flags as argv, which the fake
// executable must tolerate).
//
// It self-exits on its own short timer rather than relying on launchChrome's
// kill() to reach it: on Windows, kill() only reaches the direct child (the
// .cmd's cmd.exe host), and the actual deno.exe process survives as an
// orphan holding its inherited stderr pipe open, which would otherwise hang
// launchChrome's close() until the timer fires anyway.
async function writeSilentChromeExecutable(
  dir: string,
  port: number,
  stderrText: string,
  selfDestructMs: number = kSelfDestructMs,
): Promise<string> {
  const scriptPath = join(dir, "silent-chrome.js");
  await Deno.writeTextFile(
    scriptPath,
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
      `setTimeout(() => Deno.exit(1), ${selfDestructMs});`,
    ].join("\n"),
  );

  const deno = Deno.execPath();
  if (Deno.build.os === "windows") {
    const cmdPath = join(dir, "silent-chrome.cmd");
    await Deno.writeTextFile(
      cmdPath,
      `@echo off\r\n"${deno}" run --allow-net "${scriptPath}" %*\r\n`,
    );
    return cmdPath;
  }
  const shPath = join(dir, "silent-chrome.sh");
  await Deno.writeTextFile(
    shPath,
    `#!/bin/sh\n"${deno}" run --allow-net "${scriptPath}" "$@"\n`,
  );
  await Deno.chmod(shPath, 0o755);
  return shPath;
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
  "chrome-launch - alive-but-silent Chrome rejects, no dangling colon on empty stderr",
  async () => {
    const port = findOpenPort();
    const dir = await Deno.makeTempDir({ prefix: "chrome-launch-silent-" });
    try {
      const fakeChrome = await writeSilentChromeExecutable(dir, port, "");
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
        !err.message.includes("Chrome said:"),
        `expected no "Chrome said:" for empty stderr in: ${err.message}`,
      );
      assert(
        !err.message.trimEnd().endsWith(":"),
        `expected no dangling colon in: ${err.message}`,
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
      const fakeChrome = await writeSilentChromeExecutable(
        dir,
        port,
        "",
        selfDestructMs,
      );
      const start = Date.now();
      const err = await assertRejects(
        () => launchChrome({ appPath: fakeChrome, port, timeout: 5000 }),
        Error,
      );
      const elapsed = Date.now() - start;
      assert(
        err.message.includes("Chrome exited"),
        `expected an exit message, got: ${err.message}`,
      );
      assert(
        elapsed < selfDestructMs + 500,
        `expected exit to be reported well under a probe timeout after ` +
          `it happened (${selfDestructMs}ms + margin), took ${elapsed}ms`,
      );
    } finally {
      await Deno.remove(dir, { recursive: true }).catch(() => {});
    }
  },
);

unitTest(
  "chrome-launch - CdpClient.connect exhausts its retries with a useful message",
  async () => {
    const port = findOpenPort();
    const err = await assertRejects(() => CdpClient.connect(port), Error);
    assert(
      err.message.includes(String(port)),
      `expected port ${port} named in: ${err.message}`,
    );
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

// deno-lint-ignore require-await
unitTest(
  "chrome-launch - probeTimeoutMs never exceeds what's left of the launch budget",
  async () => {
    // Plenty of time left: capped at the per-attempt ceiling, not the full budget.
    assertEquals(probeTimeoutMs(5000), 1000);
    // Little time left: capped at what's actually left, not the per-attempt ceiling.
    assertEquals(probeTimeoutMs(50), 50);
    // Already past the deadline: clamps to zero rather than going negative.
    assertEquals(probeTimeoutMs(-10), 0);
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
 * launcher's readiness poll sees -- same Deno.serve wrapper mechanism as
 * chrome-launch-flags.test.ts's fake executable. `pageAfterMs` is measured
 * from the fake server's own start, not the caller's: `[]` until then, a
 * single real page target afterward. `undefined` means never.
 */
async function writeJsonListChromeExecutable(
  dir: string,
  port: number,
  pageAfterMs: number | undefined,
): Promise<string> {
  const scriptPath = join(dir, "json-list-chrome.js");
  await Deno.writeTextFile(
    scriptPath,
    [
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
      // Same Windows orphan issue as writeSilentChromeExecutable above:
      // launchChrome's close() only kills the .cmd's cmd.exe host, and the
      // deno.exe grandchild survives holding its inherited stderr pipe open,
      // which would otherwise hang close()'s drain loop forever.
      `setTimeout(() => Deno.exit(0), ${kSelfDestructMs});`,
    ].join("\n"),
  );

  const deno = Deno.execPath();
  if (Deno.build.os === "windows") {
    const cmdPath = join(dir, "json-list-chrome.cmd");
    await Deno.writeTextFile(
      cmdPath,
      `@echo off\r\n"${deno}" run --allow-net "${scriptPath}" %*\r\n`,
    );
    return cmdPath;
  }
  const shPath = join(dir, "json-list-chrome.sh");
  await Deno.writeTextFile(
    shPath,
    `#!/bin/sh\n"${deno}" run --allow-net "${scriptPath}" "$@"\n`,
  );
  await Deno.chmod(shPath, 0o755);
  return shPath;
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
