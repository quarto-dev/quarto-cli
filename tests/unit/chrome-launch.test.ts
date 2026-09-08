/*
 * chrome-launch.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertRejects } from "testing/asserts";
import { join } from "path";
import { launchChrome } from "../../src/core/cri/launch.ts";
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
      `setTimeout(() => Deno.exit(1), ${kSelfDestructMs});`,
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
