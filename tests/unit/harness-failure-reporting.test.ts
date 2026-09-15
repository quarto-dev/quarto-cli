/*
 * harness-failure-reporting.test.ts
 *
 * End-to-end tests for the harness's GitHub Actions failure reporting
 * (tests/test.ts, dev-docs/ci-test-log-grouping-design.md). What is under
 * test is a property of the harness's own try/catch/finally around a Deno
 * test body, so it can only be observed by running a harness test file to
 * completion: each case spawns `deno test` on
 * unit/harness-reporting-fixture.ts in a child process with
 * GITHUB_ACTIONS=true and GITHUB_STEP_SUMMARY pointed at a temp file, then
 * reads the child's stdout (annotations, Deno's own ERRORS section) and the
 * temp summary file (rows, clustered detail blocks). The exception is
 * testFileFromOrigin's QUARTO_BIN_PATH fallback below, a pure function that
 * takes its dependency as a parameter and needs no subprocess.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { testFileFromOrigin, unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { dirname, fromFileUrl, join, relative } from "../../src/deno_ral/path.ts";
import { safeRemoveSync } from "../../src/deno_ral/fs.ts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import { kStepSummaryBudgetBytes, stripAnsi } from "../../src/tools/github.ts";
import { checkLog } from "../tools/check-gha-log.ts";

const kFixture = "unit/harness-reporting-fixture.ts";

interface ChildRun {
  // stdout + stderr, ANSI stripped
  stdout: string;
  // contents of the child's step-summary file ("" when never written)
  summary: string;
  code: number;
}

function testsDir(): string {
  return dirname(dirname(fromFileUrl(import.meta.url)));
}

// Run the fixture in a child `deno test`, mirroring run-tests.ps1's deno
// invocation. `--no-check` keeps the spawn fast; the child inherits the
// harness environment (QUARTO_BIN_PATH, DENO_DIR, ...) and overrides only
// the GitHub Actions switches. QUARTO_TESTS_GHA_ORCHESTRATED is forced empty
// because inside a CI bucket step the real one IS set, which would silence
// the very emissions under test.
async function runFixture(
  opts: {
    githubActions: boolean;
    unwritableSummary?: boolean;
    // Pre-fill the step summary before the child even starts, so its very
    // first write already finds the file over budget — the cheapest way to
    // exercise the degraded (over-budget) path deterministically, without
    // touching the production budget constant.
    prefillSummaryBytes?: number;
  },
): Promise<ChildRun> {
  const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-harness-report" });
  const summary = opts.unwritableSummary
    ? join(tmpDir, "no-such-dir", "summary.md")
    : join(tmpDir, "summary.md");
  if (opts.prefillSummaryBytes) {
    Deno.writeTextFileSync(summary, "x".repeat(opts.prefillSummaryBytes));
  }
  const tests = testsDir();
  const root = dirname(tests);
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "test",
      "--config",
      "test-conf.json",
      "--no-lock",
      "--allow-all",
      "--unstable-kv",
      "--unstable-ffi",
      "--no-check",
      "--v8-flags=--enable-experimental-regexp-engine",
      `--importmap=${join(root, "src", "import_map.json")}`,
      kFixture,
    ],
    cwd: tests,
    env: {
      NO_COLOR: "1",
      GITHUB_ACTIONS: opts.githubActions ? "true" : "",
      GITHUB_STEP_SUMMARY: summary,
      QUARTO_TESTS_GHA_ORCHESTRATED: "",
      RUNNER_OS: "Linux",
    },
    stdout: "piped",
    stderr: "piped",
  });
  const out = await command.output();
  const decoder = new TextDecoder();
  const stdout = stripAnsi(
    decoder.decode(out.stdout) + decoder.decode(out.stderr),
  );
  let summaryText = "";
  try {
    summaryText = Deno.readTextFileSync(summary);
  } catch {
    // never written
  }
  // The sidecar annotation counter lives beside the summary, inside tmpDir.
  safeRemoveSync(tmpDir, { recursive: true });
  return { stdout, summary: summaryText, code: out.code };
}

// One child process shared by every GITHUB_ACTIONS=true assertion below.
let ghaRun: Promise<ChildRun> | undefined;
function gha(): Promise<ChildRun> {
  return (ghaRun ??= runFixture({ githubActions: true }));
}

// Summary table rows are single lines beginning with "| " that carry the
// test name cell; htmlEscape only rewrites & < >, so a plain-ASCII fixture
// name is a literal substring.
function summaryRowsFor(summary: string, testName: string): string[] {
  return summary
    .split("\n")
    .filter((line) => line.startsWith("| ") && line.includes(testName));
}

// ::error annotation lines for one test; the harness puts the test name in
// the title= property.
function annotationsFor(stdout: string, testName: string): string[] {
  return stdout
    .split("\n")
    .filter((line) => line.startsWith("::error") && line.includes(testName));
}

// Deno's end-of-run ERRORS section, where the error each test ACTUALLY
// failed with is printed. Annotations and summary content are emitted from
// the test bodies, above it, so slicing here isolates what Deno prints.
function denoErrorsSection(stdout: string): string {
  const lines = stdout.split("\n").map((line) => line.replace(/\r$/, ""));
  const start = lines.findIndex((line) => line.trim() === "ERRORS");
  return start === -1 ? "" : lines.slice(start).join("\n");
}

unitTest("harness-reporting - a throwing teardown on a passing test is reported", async () => {
  const run = await gha();
  assertEquals(
    summaryRowsFor(run.summary, "fixture teardown throws").length,
    1,
    `expected one summary row; summary was:\n${run.summary}`,
  );
  assertEquals(
    annotationsFor(run.stdout, "fixture teardown throws").length,
    1,
    "one ::error annotation",
  );
  assert(
    run.summary.includes("FIXTURE_TEARDOWN_BOOM"),
    "the teardown error text reaches the summary",
  );
});

unitTest("harness-reporting - a lifecycle failure is reported", async () => {
  // A throwing prereq never reaches the execute/verify catch.
  const run = await gha();
  assertEquals(
    summaryRowsFor(run.summary, "fixture prereq throws").length,
    1,
    `expected one summary row; summary was:\n${run.summary}`,
  );
  assertEquals(
    annotationsFor(run.stdout, "fixture prereq throws").length,
    1,
    "one ::error annotation",
  );
  assert(run.summary.includes("FIXTURE_PREREQ_BOOM"));
});

unitTest("harness-reporting - a non-Error throw is reported", async () => {
  const run = await gha();
  assertEquals(
    summaryRowsFor(run.summary, "fixture throws a non-Error").length,
    1,
    `expected one summary row; summary was:\n${run.summary}`,
  );
  assertEquals(
    annotationsFor(run.stdout, "fixture throws a non-Error").length,
    1,
    "one ::error annotation",
  );
  assert(run.summary.includes("FIXTURE_STRING_BOOM"));
});

unitTest("harness-reporting - a failure plus a throwing teardown is one record naming both", async () => {
  const run = await gha();
  assertEquals(
    summaryRowsFor(run.summary, "fixture verify and teardown both throw").length,
    1,
    "exactly one row, not one per error",
  );
  assertEquals(
    annotationsFor(run.stdout, "fixture verify and teardown both throw").length,
    1,
    "exactly one annotation, not one per error",
  );
  const errors = denoErrorsSection(run.stdout);
  assert(
    errors.includes("FIXTURE_VERIFY_BOOM"),
    `Deno must print the assertion; ERRORS section was:\n${errors}`,
  );
  assert(
    errors.includes("FIXTURE_TEARDOWN_BOOM_2"),
    "Deno must print the teardown failure too",
  );
  // what Deno prints, what the summary says and what the annotation says agree
  assert(run.summary.includes("FIXTURE_VERIFY_BOOM"));
  assert(run.summary.includes("FIXTURE_TEARDOWN_BOOM_2"));
});

unitTest("harness-reporting - a reporting write failure does not replace the test failure", async () => {
  // GITHUB_STEP_SUMMARY (and therefore the sidecar counter beside it) inside
  // a directory that does not exist: the portable stand-in for ENOSPC/EACCES.
  const run = await runFixture({ githubActions: true, unwritableSummary: true });
  const errors = denoErrorsSection(run.stdout);
  assert(
    errors.includes("FIXTURE_PLAIN_BOOM"),
    `the assertion must survive unwritable reporting I/O; ERRORS section was:\n${errors}`,
  );
  assert(
    !errors.includes("NotFound"),
    "no filesystem error stands in for a test failure",
  );
});

unitTest("harness-reporting - an ordinary failure still produces one row and one annotation", async () => {
  const run = await gha();
  assertEquals(summaryRowsFor(run.summary, "fixture verify throws").length, 1);
  assertEquals(annotationsFor(run.stdout, "fixture verify throws").length, 1);
  assert(run.summary.includes("FIXTURE_PLAIN_BOOM"));
});

unitTest("harness-reporting - a huge single-line excerpt is bounded, not dropped or embedded whole", async () => {
  const run = await gha();
  const huge = "z".repeat(300 * 1024);
  assertEquals(
    summaryRowsFor(run.summary, "fixture throws with a huge excerpt line").length,
    1,
    "the row still gets recorded",
  );
  assert(
    run.summary.includes("FIXTURE_HUGE_LINE_"),
    "the excerpt still identifies the failure",
  );
  assert(
    !run.summary.includes(huge),
    "the huge line is truncated, not embedded whole, in the step summary",
  );
  assert(
    run.summary.length < kStepSummaryBudgetBytes,
    "one huge excerpt does not blow past the step-summary budget on its own",
  );
  const annotations = annotationsFor(run.stdout, "fixture throws with a huge excerpt line");
  assertEquals(annotations.length, 1);
  assert(
    !annotations[0].includes(huge),
    "the annotation body is also bounded, not embedded whole",
  );
});

unitTest("harness-reporting - an over-budget failure's annotation does not promise a detail block that was never written", async () => {
  // Pre-fill the summary right at the budget so this run's very first
  // failure ("fixture verify throws", the first test registered in the
  // fixture file) is immediately over budget: no cluster is queued for it
  // (there is no room even for a degraded name-only row). Its annotation
  // must therefore NOT promise a detail block exists under its label — that
  // promise would point at a block that is never written.
  const run = await runFixture({
    githubActions: true,
    prefillSummaryBytes: kStepSummaryBudgetBytes,
  });
  assert(
    !run.summary.includes("FIXTURE_PLAIN_BOOM"),
    "no detail block was written for this failure",
  );
  const annotations = annotationsFor(run.stdout, "fixture verify throws");
  assertEquals(annotations.length, 1);
  assert(
    !annotations[0].includes("Full output"),
    "the annotation must not promise full output exists in the summary",
  );
  assert(
    !annotations[0].includes("Failure row"),
    "no row of any kind was recorded, so the annotation must not claim one exists",
  );
});

unitTest("harness-reporting - a many-line primary message still leaves room for the teardown banner and message", async () => {
  const run = await gha();
  assertEquals(
    summaryRowsFor(
      run.summary,
      "fixture throws a multi-line message and teardown also throws",
    ).length,
    1,
  );
  assert(
    run.summary.includes("TEARDOWN ALSO FAILED:"),
    `the teardown banner must survive the excerpt's line cap; summary was:\n${run.summary}`,
  );
  assert(
    run.summary.includes("FIXTURE_MULTILINE_TEARDOWN_BOOM"),
    "the teardown failure message must survive too",
  );
});

unitTest("harness-reporting - a primary message that trips both the line and byte caps still leaves room for the teardown banner and message", async () => {
  const run = await gha();
  assertEquals(
    summaryRowsFor(
      run.summary,
      "fixture throws a primary message that trips both the line and byte caps, with teardown throwing too",
    ).length,
    1,
  );
  assert(
    run.summary.includes("TEARDOWN ALSO FAILED:"),
    `the teardown banner must survive the excerpt's line cap even when byte truncation adds a marker line to the primary; summary was:\n${run.summary}`,
  );
  assert(
    run.summary.includes("FIXTURE_BOTHCAPS_TEARDOWN_BOOM"),
    "the teardown failure message must survive too",
  );
});

unitTest("harness-reporting - a passing test produces no row and no annotation", async () => {
  const run = await gha();
  assertEquals(summaryRowsFor(run.summary, "fixture passes").length, 0);
  assertEquals(annotationsFor(run.stdout, "fixture passes").length, 0);
});

unitTest("harness-reporting - grouping invariants hold across the fixture run", async () => {
  // Invariants 1-3: no nesting, markers at column 0, no harness FAILED line
  // and no ERRORS/FAILURES header inside a group.
  const run = await gha();
  const violations = checkLog(run.stdout);
  assertEquals(
    violations,
    [],
    violations.map((v) => `line ${v.line}: ${v.message}`).join("\n"),
  );
});

unitTest("harness-reporting - nothing is emitted with GITHUB_ACTIONS unset", async () => {
  const run = await runFixture({ githubActions: false });
  assertEquals(run.summary, "", "no step-summary content off CI");
  assert(!run.stdout.includes("::error"), "no annotations off CI");
  assert(!run.stdout.includes("::group::"), "no group markers off CI");
  assert(!run.stdout.includes("::endgroup::"), "no group markers off CI");
  const errors = denoErrorsSection(run.stdout);
  assert(errors.includes("FIXTURE_PLAIN_BOOM"), "failures still print");
  assert(
    errors.includes("━━━ TEST FAILURE:"),
    "the decorated failure block is unchanged",
  );
});

// deno-lint-ignore require-await
unitTest("harness-reporting - testFileFromOrigin falls back when QUARTO_BIN_PATH is unset", async () => {
  // run-tests.sh/ps1 always set QUARTO_BIN_PATH, but a bare `deno test`
  // invocation does not - this is the throw quartoConfig.binPath() produces
  // in that case, injected directly rather than by unsetting the real
  // process-global env var. Building the origin from a real path under this
  // checkout (rather than a synthetic one) keeps the fallback's relative()
  // call on the same drive as Deno.cwd() on Windows.
  const resolveBinPath = () => {
    throw new Error("Required environment variable QUARTO_BIN_PATH not specified.");
  };
  const absPath = join(testsDir(), "unit", "foo.test.ts");
  const origin = isWindows
    ? `file:///${absPath.replaceAll("\\", "/")}`
    : `file://${absPath}`;
  const result = testFileFromOrigin(origin, resolveBinPath);
  assertEquals(result.absPath, absPath);
  assertEquals(
    result.relPath,
    relative(Deno.cwd(), absPath),
    "falls back to a path relative to the current directory",
  );
});
