/*
 * chrome-launch-flags.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals, assertRejects } from "testing/asserts";
import { stub } from "testing/mock";
import { criClient } from "../../src/core/cri/cri.ts";
import { findOpenPort } from "../../src/core/port.ts";
import { unitTest } from "../test.ts";

function fakeChildProcess(): Deno.ChildProcess {
  return {
    pid: 1,
    status: Promise.resolve({ success: true, code: 0, signal: null }),
    stdin: new WritableStream<Uint8Array>(),
    stdout: new ReadableStream<Uint8Array>(),
    stderr: new ReadableStream<Uint8Array>(),
    kill: () => {},
    ref: () => {},
    unref: () => {},
    output: () =>
      Promise.resolve({
        success: true,
        code: 0,
        signal: null,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
      }),
  } as unknown as Deno.ChildProcess;
}

interface CapturedCommand {
  app: string;
  options: Deno.CommandOptions;
}

// Replaces the global Deno.Command constructor so criClient's real
// argument-construction logic runs, but no OS process is ever spawned.
// This patches the Deno namespace itself, so it intercepts the call no
// matter which module in criClient's call graph performs it - load-bearing
// for staying green across the shared-launcher refactor this test exists
// to pin behaviour against.
function stubDenoCommand(): { captured: CapturedCommand[]; restore: () => void } {
  const captured: CapturedCommand[] = [];
  // A plain `function`, not a `class`: std/testing/mock's stub() wraps the
  // replacement in its own constructor function and invokes the underlying
  // implementation via .apply(), which throws on an ES6 class ("Class
  // constructor cannot be invoked without 'new'").
  function FakeCommand(
    this: { spawn: () => Deno.ChildProcess },
    app: string,
    options: Deno.CommandOptions,
  ): void {
    captured.push({ app, options });
    this.spawn = () => fakeChildProcess();
  }
  const cmdStub = stub(
    Deno,
    "Command",
    // deno-lint-ignore no-explicit-any
    FakeCommand as unknown as (this: typeof Deno, ...args: unknown[]) => any,
  );
  return { captured, restore: () => cmdStub.restore() };
}

// criClient's readiness wait is a real fetch() against the port, so a real
// server has to be listening. Bound-but-non-200 (rather than nothing
// listening at all) matters for the rejection case: fetch() against a
// closed localhost port on Windows takes over 2s to fail with
// connection-refused, and criClient's retry loop counts a fixed 50ms per
// attempt regardless of how long each fetch() actually took, so a closed
// port would turn the nominal 3s readiness timeout into minutes of real
// wall-clock time.
async function withFakeChromeDevtoolsServer<T>(
  port: number,
  readyStatus: number,
  fn: () => Promise<T>,
): Promise<T> {
  const server = Deno.serve(
    { port, onListen: () => {} },
    (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname === "/json/list") {
        return new Response("[]", { status: readyStatus });
      }
      return new Response("", { status: 404 });
    },
  );
  try {
    return await fn();
  } finally {
    await server.shutdown();
  }
}

unitTest(
  "chrome-launch-flags - headless mode and required flags",
  async () => {
    const port = findOpenPort();
    const { captured, restore } = stubDenoCommand();
    // Read-only: never set/delete Deno.env in this suite. Test files share
    // Deno.env under the default parallel runner, and save/restore doesn't
    // help (see llm-docs/testing-patterns.md, "Environment Variable Testing
    // Pitfalls") - a concurrent test elsewhere in the suite could observe a
    // mutated value while this test is in flight. So this mirrors criClient's
    // own default-substitution logic against whatever value is actually
    // ambient, rather than forcing a specific one.
    const ambientHeadlessMode = Deno.env.get("QUARTO_CHROMIUM_HEADLESS_MODE") ??
      "none";
    const expectedHeadlessFlag = ambientHeadlessMode === "none"
      ? "--headless"
      : `--headless=${ambientHeadlessMode}`;
    try {
      await withFakeChromeDevtoolsServer(
        port,
        200,
        () => criClient("fake-chrome", port),
      );
    } finally {
      restore();
    }

    assertEquals(captured.length, 1);
    const { app, options } = captured[0];
    assertEquals(app, "fake-chrome");
    assertEquals(options.stdout, "piped");
    assertEquals(options.stderr, "piped");

    const argv = options.args as string[];
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
  },
);

unitTest(
  "chrome-launch-flags - Chrome that never becomes ready rejects instead of resolving",
  async () => {
    const port = findOpenPort();
    const { restore } = stubDenoCommand();
    try {
      await withFakeChromeDevtoolsServer(
        port,
        404,
        () => assertRejects(() => criClient("fake-chrome", port)),
      );
    } finally {
      restore();
    }
  },
);
