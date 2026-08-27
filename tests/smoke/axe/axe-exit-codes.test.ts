/*
 * axe-exit-codes.test.ts
 *
 * End-to-end exit codes for `quarto dev-call axe`, in a real subprocess.
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
import { join } from "../../../src/deno_ral/path.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { execProcess } from "../../../src/core/process.ts";
import { unitTest } from "../../test.ts";
import { quartoDevCmd } from "../../utils.ts";
import { AxeFindings } from "../../../src/command/dev-call/axe/schemas.ts";

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
) {
  unitTest(name, async () => {
    const result = await execProcess({
      cmd: quartoBin(),
      args: ["dev-call", "axe", "site", ...args],
      cwd: workingDir,
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
