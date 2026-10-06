/*
 * exec-process-stdin.test.ts
 *
 * Regression test for #14445.
 *
 * src/core/process.ts execProcess() must not leak unhandled promise
 * rejections from `process.stdin.close()`. If the child closes/errors
 * its stdin before the parent's close completes, the close Promise
 * rejects with "Writable stream is closed or errored."; an unawaited
 * close lets that rejection escape the surrounding try/catch and
 * surface as an uncaught Deno rejection that aborts the render.
 *
 * Manifests on Linux at roughly a 1% race rate when the child exits
 * without reading stdin (typst-gather analyze of a broken or
 * fast-failing input). Has not been observed on macOS arm64.
 *
 * The race is timing-dependent, so each scenario runs many iterations
 * and asserts no unhandled rejection fires.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import { execProcess } from "../../src/core/process.ts";
import { existsSync } from "../../src/deno_ral/fs.ts";
import { architectureToolsPath } from "../../src/core/resources.ts";

// Iteration count chosen so that a ~1% race produces ≥1 hit with >99.99%
// probability — enough to fail the test reliably if the bug returns.
const ITERS = 1000;
const TOML = 'discover = ["nonexistent.typ"]\npackage-cache = []\n';

// Wrap the body in an unhandledrejection listener so Deno's runner can't
// race us — we count rejections explicitly and assert at the end.
async function withRejectionTracking(
  body: () => Promise<void>,
): Promise<{ count: number; last: string; samples: string[] }> {
  let count = 0;
  let last = "";
  const samples: string[] = [];
  const handler = (ev: PromiseRejectionEvent) => {
    count++;
    // deno-lint-ignore no-explicit-any
    const reason: any = ev.reason;
    last = reason?.message ?? String(reason);
    if (samples.length < 5) samples.push(last);
    ev.preventDefault();
  };
  globalThis.addEventListener("unhandledrejection", handler);
  try {
    await body();
    // Give any deferred rejections a chance to surface.
    await new Promise((r) => setTimeout(r, 250));
  } finally {
    globalThis.removeEventListener("unhandledrejection", handler);
  }
  return { count, last, samples };
}

async function loop(
  cmd: string,
  args: string[],
  stdin: string,
  iters = ITERS,
): Promise<void> {
  for (let i = 0; i < iters; i++) {
    try {
      await execProcess(
        { cmd, args, stdout: "piped", stderr: "piped" },
        stdin,
      );
    } catch {
      // execProcess may throw legitimately (e.g. exit 1). We are hunting
      // unhandled rejections from the unawaited stdin.close(), which fire
      // on a separate microtask and are not caught by `try { await ... }`.
    }
  }
}

function assertNoRejections(
  r: { count: number; last: string; samples: string[] },
) {
  assertEquals(
    r.count,
    0,
    `${r.count} unhandled rejections. last="${r.last}"\n` +
      `samples=${JSON.stringify(r.samples, null, 2)}`,
  );
}

// Child exits without reading stdin. This is the scenario that
// reliably reproduces the bug on Linux (~1% race rate).
unitTest("execProcess - child exits without reading stdin", async () => {
  if (isWindows) return;
  assertNoRejections(await withRejectionTracking(() => loop("true", [], TOML)));
});

// Child errors out fast.
unitTest("execProcess - child exits with error", async () => {
  if (isWindows) return;
  assertNoRejections(
    await withRejectionTracking(() => loop("sh", ["-c", "exit 1"], TOML)),
  );
});

// Child reads all of stdin, writes to stdout, exits cleanly. Mimics the
// success path of typst-gather analyze.
unitTest("execProcess - child consumes stdin then exits", async () => {
  if (isWindows) return;
  assertNoRejections(await withRejectionTracking(() => loop("cat", [], TOML)));
});

// Real typst-gather, if the binary is present in the dist tree.
unitTest("execProcess - real typst-gather analyze", async () => {
  if (isWindows) return;
  const binary = architectureToolsPath("typst-gather");
  if (!existsSync(binary)) return;
  assertNoRejections(
    await withRejectionTracking(() => loop(binary, ["analyze", "-"], TOML)),
  );
});
