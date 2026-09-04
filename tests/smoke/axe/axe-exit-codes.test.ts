/*
 * axe-exit-codes.test.ts
 *
 * End-to-end exit codes for `quarto call axe`, in a real subprocess.
 *
 * Subprocess on purpose: testQuartoCmd runs quarto() in-process, and the axe
 * action leaves through exitWithCleanup on any non-zero code — an in-process
 * exit-2 fixture would take the test runner down with it. This is the one
 * place the command's most-advertised property (fail-closed reaches the exit
 * code) is pinned end to end.
 *
 * The fixture is a hand-written static page with a planted critical
 * violation (an alt-less <img>) — no render step, so each case costs one
 * browser launch over two cells.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals } from "testing/asserts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { execProcess } from "../../../src/core/process.ts";
import { unitTest } from "../../test.ts";
import { quartoDevCmd } from "../../utils.ts";
import { AxeFindings } from "../../../src/command/call/axe/schemas.ts";

// Under run-tests.sh/.ps1 the dev binary's dir is exported; resolve it
// explicitly so the subprocess never falls through to a release quarto that
// happens to be on PATH.
function quartoBin(): string {
  const binPath = Deno.env.get("QUARTO_BIN_PATH");
  return binPath
    ? join(binPath, isWindows ? "quarto.cmd" : "quarto")
    : quartoDevCmd();
}

const workingDir = Deno.makeTempDirSync({ prefix: "quarto-axe-exit" });
Deno.mkdirSync(join(workingDir, "site"));
Deno.writeTextFileSync(
  join(workingDir, "site", "index.html"),
  `<!DOCTYPE html>
<html lang="en"><head><title>exit codes</title></head>
<body><main><h1>Exit codes</h1><img src="dot.png"></main></body></html>
`,
);
Deno.writeTextFileSync(join(workingDir, "site", "dot.png"), "not-really-a-png");

function findings(): AxeFindings {
  return JSON.parse(
    Deno.readTextFileSync(join(workingDir, "_axe-checks", "findings.json")),
  ) as AxeFindings;
}

function axeExitTest(
  name: string,
  args: string[],
  expectedCode: number,
  verify?: () => void,
  env?: Record<string, string>,
) {
  unitTest(name, async () => {
    const result = await execProcess({
      cmd: quartoBin(),
      args: ["call", "axe", "site", ...args],
      cwd: workingDir,
      env,
      stdout: "piped",
      stderr: "piped",
    });
    assertEquals(
      result.code,
      expectedCode,
      `expected exit ${expectedCode}, got ${result.code}\n` +
        `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    verify?.();
  }, {
    teardown: () => {
      const artifacts = join(workingDir, "_axe-checks");
      try {
        Deno.removeSync(artifacts, { recursive: true });
      } catch (_e) {
        // a case that failed before writing artifacts has nothing to remove
      }
      return Promise.resolve();
    },
  });
}

axeExitTest(
  "axe exit codes - findings alone exit 0",
  [],
  0,
  () => {
    // the planted violation is found and reported; without --fail-on it
    // never fails the command
    assert(findings().counts.new >= 1, "the planted image-alt went missing");
  },
);

axeExitTest(
  "axe exit codes - --fail-on at/above a new finding's impact exits 1",
  // the planted image-alt is critical, so `serious` also exercises at-or-above
  ["--fail-on", "serious"],
  1,
);

axeExitTest(
  "axe exit codes - an incomplete scan exits 2, and 2 beats 1",
  // 1ms can't survive the first CDP round-trip, so every cell times out;
  // --fail-on minor proves incompleteness outranks the findings threshold
  ["--timeout", "1", "--fail-on", "minor"],
  2,
  () => {
    // fail-closed leaves data behind, never a pass: the artifacts exist and
    // name the cells that did not complete
    const results = findings();
    assert(results.cells.notOk > 0, "expected not-ok cells");
    assertEquals(results.cells.ok, 0);
    assert(
      results.notOkCells.every((cell) => cell.status === "timeout"),
      JSON.stringify(results.notOkCells),
    );
  },
);

axeExitTest(
  "axe exit codes - an incremental project render skips, exiting 0",
  // --fail-on minor would exit 1 on the planted violation if the scan ran, so
  // a 0 here can only mean the gate fired before any of it happened
  ["--fail-on", "minor"],
  0,
  () => {
    assert(
      !existsSync(join(workingDir, "_axe-checks")),
      "a skipped scan must not write artifacts",
    );
  },
  // what quarto gives a post-render script when the render was incremental:
  // OUTPUT_DIR present, RENDER_ALL absent
  { QUARTO_PROJECT_OUTPUT_DIR: join(workingDir, "site") },
);

// Usage errors: exit 3, and never 1 — which would be indistinguishable from
// "--fail-on found something". Both throw sites are covered: axeScanConfig
// (before the action calls axeScan) and applyThemesFilter (inside it).
// Neither reaches a browser launch, so these cost nothing.
axeExitTest(
  "axe exit codes - a bad flag value exits 3, not 1",
  ["--fail-on", "serius"],
  3,
);

axeExitTest(
  "axe exit codes - a filter that matches nothing exits 3, not 2",
  // the fixture is a static page with no colour-scheme script, so every page
  // is one-mode: asking for dark alone can never match a cell
  ["--themes", "dark"],
  3,
);

unitTest(
  "axe exit codes - a browser that cannot start exits 2, leaving no stale summary",
  async () => {
    // QUARTO_CHROMIUM pointing at a file that exists but is not a browser
    // wins discovery, then the spawn fails — the closest forcible stand-in
    // for "no usable Chrome" on machines that have one installed.
    const notABrowser = join(workingDir, "not-a-browser");
    Deno.writeTextFileSync(notABrowser, "");
    // a previous scan's summary must not survive to be read as current
    const artifacts = join(workingDir, "_axe-checks");
    Deno.mkdirSync(artifacts, { recursive: true });
    const staleFindings = join(artifacts, "findings.json");
    Deno.writeTextFileSync(staleFindings, `{"stale": true}`);

    const result = await execProcess({
      cmd: quartoBin(),
      args: ["call", "axe", "site"],
      cwd: workingDir,
      env: { QUARTO_CHROMIUM: notABrowser },
      stdout: "piped",
      stderr: "piped",
    });
    assertEquals(
      result.code,
      2,
      `expected exit 2\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    assert(
      (result.stderr ?? "").includes("Could not start headless Chrome"),
      `stderr must name the launch failure:\n${result.stderr}`,
    );
    assert(
      !existsSync(staleFindings),
      "a failed launch must not leave a stale findings.json reading as current",
    );
  },
  {
    teardown: () => {
      const artifacts = join(workingDir, "_axe-checks");
      if (existsSync(artifacts)) {
        Deno.removeSync(artifacts, { recursive: true });
      }
      return Promise.resolve();
    },
  },
);
