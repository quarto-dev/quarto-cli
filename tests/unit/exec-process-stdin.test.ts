/*
 * exec-process-stdin.test.ts
 *
 * Reproducer for #14445.
 *
 * src/core/process.ts execProcess() calls `process.stdin.close()` without
 * awaiting the returned Promise. If the child closes/errors its stdin
 * before the parent's close() runs, that Promise rejects with "Writable
 * stream is closed or errored." and surfaces as an unhandled rejection,
 * aborting the render.
 *
 * Manifests intermittently on Linux (Ubuntu 22.04 and 24.04) when running
 * typst-gather. Has not reproduced on macOS arm64 in 500-iter probes.
 *
 * These tests run many iterations of execProcess scenarios that exercise
 * the same code path and assert that no unhandled rejection occurs.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import { execProcess } from "../../src/core/process.ts";
import { existsSync } from "../../src/deno_ral/fs.ts";
import { architectureToolsPath } from "../../src/core/resources.ts";

const ITERS = 200;
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
): Promise<void> {
  for (let i = 0; i < ITERS; i++) {
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

// 1. Child exits without reading stdin. Closest synthetic to the
//    typst-gather GLIBC failure: binary exits before consuming any input.
unitTest(
  "execProcess stdin.close - child that exits without reading (#14445)",
  async () => {
    if (isWindows) return;
    const r = await withRejectionTracking(() => loop("true", [], TOML));
    assertEquals(
      r.count,
      0,
      `${r.count}/${ITERS} unhandled rejections. last="${r.last}"\n` +
        `samples=${JSON.stringify(r.samples, null, 2)}`,
    );
  },
);

// 2. Child errors out fast.
unitTest(
  "execProcess stdin.close - child that exits with error (#14445)",
  async () => {
    if (isWindows) return;
    const r = await withRejectionTracking(() =>
      loop("sh", ["-c", "exit 1"], TOML)
    );
    assertEquals(
      r.count,
      0,
      `${r.count}/${ITERS} unhandled rejections. last="${r.last}"\n` +
        `samples=${JSON.stringify(r.samples, null, 2)}`,
    );
  },
);

// 3. Child reads all of stdin, writes to stdout, exits cleanly. Mimics the
//    success path of typst-gather analyze.
unitTest(
  "execProcess stdin.close - child that consumes stdin then exits (#14445)",
  async () => {
    if (isWindows) return;
    const r = await withRejectionTracking(() => loop("cat", [], TOML));
    assertEquals(
      r.count,
      0,
      `${r.count}/${ITERS} unhandled rejections. last="${r.last}"\n` +
        `samples=${JSON.stringify(r.samples, null, 2)}`,
    );
  },
);

// 4. Real typst-gather, if the binary is present in the dist tree.
//    This is the actual failing path in #14445.
unitTest(
  "execProcess stdin.close - real typst-gather analyze (#14445)",
  async () => {
    if (isWindows) return;
    const binary = architectureToolsPath("typst-gather");
    if (!existsSync(binary)) {
      // Binary not in dist tree on this runner; nothing to test.
      return;
    }
    const r = await withRejectionTracking(() =>
      loop(binary, ["analyze", "-"], TOML)
    );
    assertEquals(
      r.count,
      0,
      `${r.count}/${ITERS} unhandled rejections. last="${r.last}"\n` +
        `samples=${JSON.stringify(r.samples, null, 2)}`,
    );
  },
);
