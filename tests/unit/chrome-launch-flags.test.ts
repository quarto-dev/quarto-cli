/*
 * chrome-launch-flags.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert } from "testing/asserts";
import { join } from "path";
import { criClient } from "../../src/core/cri/cri.ts";
import { findOpenPort } from "../../src/core/port.ts";
import { unitTest } from "../test.ts";

// Generates a fake Chrome executable: a platform-native wrapper (.cmd on
// Windows, a shebang script on Unix) that re-invokes the currently running
// deno binary to run a small script. That script records its own argv --
// exactly what criClient passed as Chrome's command line -- to a JSON file,
// then serves /json/list so criClient's readiness check resolves. A
// /shutdown route lets the test terminate it deterministically instead of
// guessing at a lifetime.
async function writeFakeChromeExecutable(
  dir: string,
  argvOutPath: string,
  port: number,
): Promise<string> {
  const scriptPath = join(dir, "fake-chrome.js");
  await Deno.writeTextFile(
    scriptPath,
    [
      "const args = Deno.args;",
      `await Deno.writeTextFile(${
        JSON.stringify(argvOutPath)
      }, JSON.stringify(args));`,
      `Deno.serve({ port: ${port}, onListen: () => {} }, (req) => {`,
      "  const url = new URL(req.url);",
      '  if (url.pathname === "/json/list") {',
      '    return new Response("[]", { status: 200 });',
      '  } else if (url.pathname === "/shutdown") {',
      "    setTimeout(() => Deno.exit(0), 50);",
      '    return new Response("", { status: 200 });',
      "  }",
      '  return new Response("", { status: 404 });',
      "});",
    ].join("\n"),
  );

  const deno = Deno.execPath();
  if (Deno.build.os === "windows") {
    const cmdPath = join(dir, "fake-chrome.cmd");
    await Deno.writeTextFile(
      cmdPath,
      `@echo off\r\n"${deno}" run --allow-net --allow-write="${argvOutPath}" "${scriptPath}" %*\r\n`,
    );
    return cmdPath;
  }
  const shPath = join(dir, "fake-chrome.sh");
  await Deno.writeTextFile(
    shPath,
    `#!/bin/sh\n"${deno}" run --allow-net --allow-write="${argvOutPath}" "${scriptPath}" "$@"\n`,
  );
  await Deno.chmod(shPath, 0o755);
  return shPath;
}

// Polls until the fake Chrome's port stops answering, i.e. the process has
// actually exited. Waiting on this (rather than a fixed delay after the
// /shutdown request) avoids removing the temp dir while the still-running
// process holds its script file open, which fails with "file in use" on
// Windows.
async function waitForPortClosed(
  port: number,
  timeoutMs = 2000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://localhost:${port}/json/list`);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

unitTest(
  "chrome-launch-flags - headless mode and required flags",
  async () => {
    const port = findOpenPort();
    const dir = await Deno.makeTempDir({ prefix: "chrome-launch-flags-" });
    try {
      const argvOutPath = join(dir, "argv.json");
      const fakeChrome = await writeFakeChromeExecutable(
        dir,
        argvOutPath,
        port,
      );

      // Read-only: never set/delete Deno.env in this suite. Test files
      // share Deno.env under the default parallel runner, and save/restore
      // doesn't help (see llm-docs/testing-patterns.md, "Environment
      // Variable Testing Pitfalls"). Mirror criClient's own
      // default-substitution logic against whatever value is actually
      // ambient, rather than forcing a specific one.
      const ambientHeadlessMode =
        Deno.env.get("QUARTO_CHROMIUM_HEADLESS_MODE") ?? "none";
      const expectedHeadlessFlag = ambientHeadlessMode === "none"
        ? "--headless"
        : `--headless=${ambientHeadlessMode}`;

      await criClient(fakeChrome, port);

      const argv = JSON.parse(
        await Deno.readTextFile(argvOutPath),
      ) as string[];
      assert(
        argv.includes(expectedHeadlessFlag),
        `expected ${expectedHeadlessFlag} in ${JSON.stringify(argv)}`,
      );
      assert(argv.includes("--no-sandbox"));
      assert(argv.includes("--disable-gpu"));
      assert(argv.includes("--renderer-process-limit=1"));
      assert(argv.includes(`--remote-debugging-port=${port}`));
      assert(
        !argv.some((a) => a.startsWith("--user-data-dir")),
        `expected no --user-data-dir in ${JSON.stringify(argv)}`,
      );
    } finally {
      await fetch(`http://localhost:${port}/shutdown`).catch(() => {});
      await waitForPortClosed(port);
      await Deno.remove(dir, { recursive: true }).catch(() => {});
    }
  },
);
