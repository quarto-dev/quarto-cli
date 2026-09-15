/*
 * test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync, safeRemoveSync } from "../src/deno_ral/fs.ts";
import { AssertionError, fail } from "testing/asserts";
import { warning } from "../src/deno_ral/log.ts";
import { initDenoDom } from "../src/core/deno-dom.ts";

import {
  cleanupLogger,
  flushLoggers,
  initializeLogger,
  logError,
  LogFormat,
  LogLevel,
} from "../src/core/log.ts";
import { appendLogError, isBinaryMode, runQuarto } from "./quarto-cmd.ts";
import { join } from "../src/deno_ral/path.ts";
import * as colors from "fmt/colors";
import { runningInCI } from "../src/core/ci-info.ts";
import { fromFileUrl, relative } from "../src/deno_ral/path.ts";
import { quartoConfig } from "../src/core/quarto.ts";
import { isWindows } from "../src/deno_ral/platform.ts";
import {
  AnnotationBudget,
  annotationBody,
  appendStepSummaryBounded,
  appendStepSummaryFirstFit,
  excerptSignature,
  type FailureCluster,
  failureLabel,
  error as ghError,
  harnessOwnsStep,
  isGitHubActions,
  kAnnotationExcerptLines,
  kExcerptMaxBytes,
  stripAnsi,
  summaryClusterBlock,
  summaryTableHeader,
  summaryTableRow,
  summaryTableRowNameOnly,
  type SummaryRowOutcome,
  truncateUtf8Bytes,
} from "../src/tools/github.ts";
import {
  closeTestFileGroup,
  enterTestFileGroup,
  testFileUrlFromStack,
} from "./gha-grouping.ts";

// GitHub Actions failure-surfacing state (Phase 1 of
// dev-docs/ci-test-log-grouping-design.md). Everything here is a no-op unless
// GITHUB_ACTIONS=true, so local test output stays byte-identical.
//
// SCOPE WARNING: Deno instantiates each test FILE's module graph separately
// (verified on the pinned 2.7.14) — this module-level state is per test file,
// not per process, and `unload` fires once per file. Anything that must be
// per-STEP (the annotation budget) is coordinated through a sidecar file
// inside AnnotationBudget instead of module state.
const kExcerptLines = 20;
// Lines reserved after a capped primary message when a teardown/cleanup
// failure will also be reported: the blank separator, the banner, and at
// least the first line of the secondary message (see reportFailure).
const kFinallyReservedLines = 3;
// Same reservation, but sized for annotationBody's much smaller
// kAnnotationExcerptLines window rather than kExcerptLines: the banner and
// the first line of the secondary message, with no separator line (the
// annotation excerpt is built fresh, not sliced from the primary excerpt).
const kFinallyAnnotationReservedLines = 2;
const annotationBudget = new AnnotationBudget();
// Per-file header flag: each failing test file starts its own summary table.
let summaryHeaderEmitted = false;
// Phase 2.1 (dev-docs/ci-test-log-grouping-design.md): the per-file group is
// opened once at registration (module-eval) time — before Deno prints its
// "running N tests from" and announcement frame lines — so those lines land
// inside the group instead of above it. Per-file module state (see SCOPE
// WARNING above) makes this once-per-file for free, mirroring
// summaryHeaderEmitted; the first test() call in the file attempts it.
let registrationGroupAttempted = false;
// GFM ends a table at the first non-row line, so per-failure <details> blocks
// cannot sit between table rows; buffer them and flush after this file's rows
// at its unload event. Failures with an identical excerpt signature cluster
// into ONE block (keyed by signature) — a run where dozens of tests share one
// error collapses to a handful of blocks instead of dozens of duplicates. The
// first member's label anchors the cluster; the map is per test-file module
// instance (see the SCOPE WARNING above), which is why the ordinal/label are
// step-wide (sidecar counter) but the clustering is per file.
const pendingClusters = new Map<string, FailureCluster>();

if (isGitHubActions()) {
  globalThis.addEventListener("unload", () => {
    // Fires at the end of EACH test file's module instance. Close this
    // file's group if still open — this is what ends a passing file's group
    // before the next file starts, and keeps Deno's terminal
    // ERRORS/FAILURES/summary sections outside any group (Phase 2). No-op
    // unless the harness owns the step.
    closeTestFileGroup();
    // Flush this file's clustered detail blocks after its row table (one
    // block per signature), stopping the moment one no longer fits — a
    // cluster queued while writing rows can still be dropped here if later
    // files' content used up the shared budget in between; that case is not
    // knowable at queue time (see the `SummaryRowOutcome` doc).
    for (const cluster of pendingClusters.values()) {
      if (!appendStepSummaryBounded(summaryClusterBlock(cluster))) break;
    }
  });
}

export interface TestLogConfig {
  // Path to log file
  log?: string;

  // Log level
  level?: LogLevel;

  // Log format
  format?: LogFormat;
}
export interface TestDescriptor {
  // The name of the test
  name: string;

  // Sets up the test
  context: TestContext;

  // Binary mode passes the child log target.
  execute: (logFile?: string) => Promise<void>;

  // Used to verify the outcome of the test
  verify: Verify[];

  // type of test
  type: "smoke" | "unit";

  // Optional logging configuration
  logConfig?: TestLogConfig;
}

export interface TestContext {
  name?: string;

  // Checks that prereqs for the test are met (async conditional skip)
  // - Returns false: Test is SKIPPED with warning message (not failed)
  // - Throws/rejects: Test FAILS (propagates to the outer catch as the
  //   primary failure, same as any other lifecycle error)
  // Use cases:
  //   - Tool availability checks (e.g., which("rsvg-convert"))
  //   - Initialization that might fail (e.g., schema loading)
  // Difference from ignore: Can be async, runs inside test, handles exceptions
  prereq?: () => Promise<boolean>;

  // Cleans up the test
  teardown?: () => Promise<void>;

  // Sets up the test
  setup?: () => Promise<void>;

  // Request that the test be run from another working directory
  cwd?: () => string;

  // Control of underlying sanitizer
  sanitize?: { resources?: boolean; ops?: boolean; exit?: boolean };

  // Control if test is ran or skipped (static boolean only)
  // - true: Test is completely IGNORED by Deno (not run, not counted)
  // - false: Test runs normally
  // Use cases:
  //   - Static platform checks (e.g., isWindows)
  //   - Static configuration flags
  // Limitation: Must be a simple boolean value computed at registration time
  // For dynamic/async conditional skip (e.g., tool availability), use prereq instead
  ignore?: boolean;

  // environment to pass to downstream processes
  env?: Record<string, string>;

  // Maximum time (ms) the quarto command may run before the test fails.
  // Defaults to 600000 (10 minutes). Lower it to assert a performance budget
  // (e.g. a render that must not regress into a hang).
  timeout?: number;

  // Ignore this test in binary mode because it requires in-process internals.
  requiresDevQuarto?: boolean;
}

// Allow to merge test contexts in Tests helpers
export function mergeTestContexts(
  baseContext: TestContext,
  additionalContext?: TestContext,
): TestContext {
  if (!additionalContext) {
    return baseContext;
  }

  return {
    // override name if provided
    name: additionalContext.name || baseContext.name,
    // combine prereq conditions
    prereq: async () => {
      const baseResult = !baseContext.prereq || await baseContext.prereq();
      const additionalResult = !additionalContext.prereq ||
        await additionalContext.prereq();
      return baseResult && additionalResult;
    },
    // run teardowns in reverse order
    teardown: async () => {
      if (baseContext.teardown) await baseContext.teardown();
      if (additionalContext.teardown) await additionalContext.teardown();
    },
    // run setups in order
    setup: async () => {
      if (additionalContext.setup) await additionalContext.setup();
      if (baseContext.setup) await baseContext.setup();
    },
    // override cwd if provided
    cwd: additionalContext.cwd || baseContext.cwd,
    // merge sanitize options
    sanitize: {
      resources: additionalContext.sanitize?.resources ??
        baseContext.sanitize?.resources,
      ops: additionalContext.sanitize?.ops ?? baseContext.sanitize?.ops,
      exit: additionalContext.sanitize?.exit ?? baseContext.sanitize?.exit,
    },
    // override ignore if provided
    ignore: additionalContext.ignore ?? baseContext.ignore,
    requiresDevQuarto: additionalContext.requiresDevQuarto ??
      baseContext.requiresDevQuarto,
    // merge env with additional context taking precedence
    env: { ...baseContext.env, ...additionalContext.env },
    // override timeout if provided
    timeout: additionalContext.timeout ?? baseContext.timeout,
  };
}

export function testQuartoCmd(
  cmd: string,
  args: string[],
  verify: Verify[],
  context?: TestContext,
  name?: string,
  logConfig?: TestLogConfig,
) {
  if (name === undefined) {
    name = `quarto ${cmd} ${args.join(" ")}`;
  }
  test({
    name,
    execute: async (logFile?: string) => {
      await runQuarto([cmd, ...args], {
        env: context?.env,
        logFile,
        logLevel: logConfig?.level,
        logFormat: logConfig?.format,
        timeoutMs: context?.timeout,
        // Let verifiers report failures from the log.
        throwOnFailure: false,
      });
    },
    verify,
    context: context || {},
    type: "smoke",
    logConfig, // Pass log config to test
  });
}

export interface Verify {
  name: string;
  verify: (outputs: ExecuteOutput[]) => Promise<void>;
}

export interface ExecuteOutput {
  msg: string;
  level: number;
  levelName: string;
}

export function unitTest(
  name: string,
  ver: () => Promise<unknown>, // VoidFunction,
  context?: TestContext,
) {
  test({
    name,
    type: "unit",
    context: context || {},
    execute: () => {
      return Promise.resolve();
    },
    verify: [
      {
        name: `${name}`,
        verify: async (_outputs: ExecuteOutput[]) => {
          const timeout = new Promise((_resolve, reject) => {
            setTimeout(
              () =>
                reject(
                  new AssertionError(
                    `timed out after 2 minutes. Something may be wrong with verify function in the test '${name}'.`,
                  ),
                ),
              120000,
            );
          });
          await Promise.race([ver(), timeout]);
        },
      },
    ],
  });
}

// Resolve a Deno test's declaring file from context.origin: the absolute path
// (fromFileUrl on Windows, URL pathname elsewhere) and the tests-relative path
// (run-tests.sh runs from tests/). Used both to open the per-file GitHub
// Actions group at the start of fn and to build the repro command on failure.
//
// The tests-relative path is anchored on QUARTO_BIN_PATH, which run-tests.sh
// and run-tests.ps1 always set - but a bare `deno test` invocation (e.g. a CI
// job that skips those wrappers) leaves it unset, and resolveBinPath() throws.
// This now runs at test registration (module-eval) time, not just on
// failure, so that throw can't be allowed to take down the whole file's
// registration: fall back to a path relative to the current directory, which
// is `tests/` for every supported invocation. resolveBinPath is a parameter
// (not called directly) so the fallback is unit-testable without an env var.
export function testFileFromOrigin(
  origin: string,
  resolveBinPath: () => string = quartoConfig.binPath,
): {
  absPath: string;
  relPath: string;
} {
  const absPath = isWindows ? fromFileUrl(origin) : (new URL(origin)).pathname;
  let relPath: string;
  try {
    const quartoRoot = join(resolveBinPath(), "..", "..", "..");
    relPath = relative(join(quartoRoot, "tests"), absPath);
  } catch {
    relPath = relative(Deno.cwd(), absPath);
  }
  return { absPath, relPath };
}

// Resolve the registering test file at registration (module-eval) time, when
// there is no context.origin yet, by walking the current call stack (Phase
// 2.1). testFileUrlFromStack picks the first `.test.ts` frame — the file whose
// top-level test() call is running — and testFileFromOrigin turns that URL into
// the tests-relative forward-slash path. A stack-parse failure (undefined) is
// only a lost early open: the body-time enterTestFileGroup(origin) still opens
// (or transitions to) the correct group from the authoritative context.origin.
// A stack-parse success that resolves to the wrong `.test.ts` frame (e.g. a
// helper module coincidentally named with that suffix) opens the group under
// the wrong title until that same body-time enter corrects it.
function testFileFromStack(): string | undefined {
  const url = testFileUrlFromStack(new Error().stack);
  if (url === undefined) return undefined;
  return testFileFromOrigin(url).relPath.replaceAll("\\", "/");
}

// Separates a teardown failure from the primary failure it landed on top of.
// Appears in the thrown error's message, in the annotation excerpt and in the
// step-summary detail block, so all three name both failures.
const kTeardownBanner = "TEARDOWN ALSO FAILED:";

// A log-file removal or logger-cleanup error must not be reported as
// "teardown also failed" - that would send the reader to the wrong code.
// Distinct banner, same shape.
const kCleanupBanner = "CLEANUP ALSO FAILED:";

function bannerFor(phase: "teardown" | "cleanup"): string {
  return phase === "teardown" ? kTeardownBanner : kCleanupBanner;
}

// Normalize an arbitrary thrown value - a test can throw a string or a plain
// object - into the message/stack pair every reporting path needs. Same shape
// the binary-mode execute handler already uses.
function describeThrow(value: unknown): { message: string; stack: string } {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack ?? "" };
  }
  return { message: String(value), stack: "" };
}

// A captured throw, boxed so a thrown `undefined` is still a failure. `phase`
// records whether it came from teardown or from one of the cleanup steps
// (safeRemoveSync/cleanupLogOnce) that run just before it, so callers can
// report the right banner for each.
interface Thrown {
  value: unknown;
  phase: "teardown" | "cleanup";
}

// The primary failure plus whatever the execute/verify path captured for it.
// A lifecycle failure (initDenoDom, prereq, logger init) has the error only.
interface PrimaryFailure {
  value: unknown;
  message: string;
  stack: string;
  logMessages?: ExecuteOutput[];
}

// Everything reportFailure needs that is not an error.
interface FailureContext {
  // Deno test name: the annotation title and the summary row's Test cell.
  testName: string;
  // Deno's per-test declaring-file URL, resolved to the repro/annotation path.
  origin: string;
  // performance.now() at the start of the test body.
  testStart: number;
}

// Emit this failure's GitHub Actions records: the step-summary row (all CI
// modes) and, when the harness owns the step, the ::error annotation. Called
// exactly once per failing test, from the outer catch - the one place every
// failure passes through - and only after teardown, so a teardown failure is
// part of the same record. No-op off CI.
//
// Best-effort by construction: an exception is already in flight whenever
// this runs, so nothing in here may replace it.
function reportFailure(
  primary: PrimaryFailure | undefined,
  finallyFailure: Thrown | undefined,
  ctx: FailureContext,
): void {
  if (!isGitHubActions()) return;
  try {
    const fwd = (p: string) => p.replaceAll("\\", "/");
    const { absPath, relPath } = testFileFromOrigin(ctx.origin);
    const command = isWindows ? "run-tests.ps1" : "./run-tests.sh";
    // The repro path is tests-relative (run-tests.sh runs from
    // tests/); the annotation file= is repo-relative with forward
    // slashes. For smoke-all doc tests the navigable file is the
    // rendered document (embedded in the test name by
    // smoke-all.test.ts), not the harness .test.ts file.
    let reproPath = fwd(relPath);
    if (fwd(absPath).endsWith("/smoke/smoke-all.test.ts")) {
      const m = fwd(ctx.testName).match(
        /(\S+\.(?:qmd|ipynb|md))(?=\s|$)/,
      );
      if (m) {
        reproPath = m[1];
      }
    }
    const annotationFile = `tests/${reproPath}`;
    const repro = `${command} ${reproPath}`;

    const rawExcerpt: string[] = [];
    if (primary) {
      // When a teardown/cleanup failure will also be reported, reserve
      // headroom for it in the primary message, by LINES as well as by
      // BYTES: an unbounded primary message (a base64 data URI, a
      // serialized document, a long JSON payload) would otherwise push the
      // banner below out of both the 20-line excerpt and the 5-line
      // annotation body before the overall byte cap below even runs — but a
      // primary message with many SHORT lines (each well under the byte
      // cap) can just as easily push the banner out of the excerpt via the
      // later line slice alone, without ever tripping the byte cap. The byte
      // cap runs FIRST, and the line cap runs on its result, because
      // truncateUtf8Bytes can itself append a "…[truncated]" marker line -
      // if the line cap ran first, that marker would land on top of the
      // reserved lines instead of counting against them, one line over
      // budget. Capping the (already byte-bounded) primary to
      // kExcerptLines - kFinallyReservedLines lines here reserves room for
      // the blank separator, the banner, and at least the first line of the
      // secondary message. This does not protect against the secondary
      // message ALSO being pathologically huge (in bytes or in lines) -
      // only the primary one.
      rawExcerpt.push(
        finallyFailure
          ? truncateUtf8Bytes(primary.message, kExcerptMaxBytes / 2)
            .split("\n")
            .slice(0, kExcerptLines - kFinallyReservedLines)
            .join("\n")
          : primary.message,
      );
    }
    if (finallyFailure) {
      // Immediately after the primary message, ahead of the stack, so both
      // the 20-line excerpt and the 5-line annotation body name it.
      if (rawExcerpt.length > 0) {
        rawExcerpt.push("");
      }
      rawExcerpt.push(
        bannerFor(finallyFailure.phase),
        describeThrow(finallyFailure.value).message,
      );
    }
    if (primary?.stack) {
      rawExcerpt.push(primary.stack);
    } else if (finallyFailure) {
      // A teardown-only failure has no primary, so its own stack is the
      // only pointer to where it threw - without it the banner above names
      // the failure but not its location.
      const stack = describeThrow(finallyFailure.value).stack;
      if (stack) rawExcerpt.push(stack);
    }
    const logMessages = primary?.logMessages;
    if (logMessages && logMessages.length > 0) {
      rawExcerpt.push("OUTPUT:");
      for (const out of logMessages) {
        for (const part of out.msg.split("\n")) {
          rawExcerpt.push("    " + part);
        }
      }
    }
    // kExcerptLines bounds line COUNT; a single line can still run to
    // hundreds of KB, so also bound bytes (kExcerptMaxBytes) - otherwise one
    // failure's excerpt could dominate the shared step-summary budget below.
    const excerpt = truncateUtf8Bytes(
      stripAnsi(rawExcerpt.join("\n"))
        .split("\n")
        .slice(0, kExcerptLines)
        .join("\n"),
      kExcerptMaxBytes,
    );

    // annotationBody keeps only its first kAnnotationExcerptLines NON-EMPTY
    // lines of whatever excerpt it's given, after its own defensive
    // truncateUtf8Bytes(excerpt, kExcerptMaxBytes) - a much smaller line
    // window than kExcerptLines, and a byte cap the primary message above
    // was never bounded against for THIS excerpt. A primary message with as
    // few as kAnnotationExcerptLines non-empty lines, or with a single line
    // that alone approaches kExcerptMaxBytes, already fills that window,
    // silently dropping the teardown banner and message from the annotation
    // even though both still fit in the fuller step-summary excerpt. Build
    // the annotation body from a dedicated, reserved excerpt instead of
    // reusing `excerpt` when a teardown/cleanup failure rides along -
    // capping the primary portion's bytes BEFORE appending the banner and
    // message, so annotationBody's own byte truncation lands after them
    // instead of cutting into the primary and consuming them too; otherwise
    // reuse `excerpt` unchanged.
    const annotationExcerpt = finallyFailure
      ? [
        ...truncateUtf8Bytes(
          stripAnsi(primary?.message ?? ""),
          kExcerptMaxBytes / 2,
        )
          .split("\n")
          .filter((line) => line.trim().length > 0)
          .slice(0, kAnnotationExcerptLines - kFinallyAnnotationReservedLines),
        bannerFor(finallyFailure.phase),
        describeThrow(finallyFailure.value).message,
      ].join("\n")
      : excerpt;

    // Record the failure step-wide (sidecar counter) to get its
    // ordinal, then build the navigation label. This runs for EVERY
    // CI failure — including orchestrated bucket legs, whose rows
    // need labels too — because the counter write is a file, not
    // stdout, so orchestrated stdout stays byte-identical. Only the
    // emit decisions below are gated on the harness owning the step.
    const decision = annotationBudget.recordFailure();
    const label = failureLabel(
      decision.ordinal,
      Deno.env.get("RUNNER_OS") ?? "",
      Deno.env.get("QUARTO_TESTS_GHA_LABEL_TAG") ?? "",
    );

    // Step-summary row — attempted in ALL modes. Within a test file, its
    // rows take precedence over its detail blocks
    // (dev-docs/ci-test-log-grouping-design.md invariant 4), which is why
    // the row streams here and the blocks wait for unload: try the full row
    // first, and only degrade to name-only once it no longer fits. appendStepSummaryFirstFit tries both candidates before
    // deciding whether the truncation notice is warranted — trying the full
    // row and emitting the notice on refusal (the old sequence) would
    // consume the notice's reserved headroom before the smaller name-only
    // candidate got its turn, so a row that would have fit before the
    // notice could be refused after it.
    if (!summaryHeaderEmitted) {
      appendStepSummaryBounded(summaryTableHeader());
      summaryHeaderEmitted = true;
    }
    const durationMs = Math.round(performance.now() - ctx.testStart);
    const rowIndex = appendStepSummaryFirstFit([
      summaryTableRow(label, annotationFile, ctx.testName, durationMs),
      summaryTableRowNameOnly(label, annotationFile, ctx.testName),
    ]);
    const rowOutcome: SummaryRowOutcome = rowIndex === 0
      ? "detail"
      : rowIndex === 1
      ? "name-only"
      : "none";
    if (rowOutcome === "detail") {
      // Cluster the detail block by excerpt signature: identical
      // errors share ONE block, anchored by (and headed with) the
      // FIRST member's label. Each row keeps its OWN unique label
      // (matching its annotation title); a non-first member's second
      // navigation hit is its `- L-Fn ·` line in the cluster's
      // member list, not a heading. The row already streamed above,
      // so a mid-file crash still leaves the complete record.
      const signature = excerptSignature(excerpt);
      const member = {
        label,
        file: annotationFile,
        testName: ctx.testName,
        repro,
      };
      const existing = pendingClusters.get(signature);
      if (existing) {
        existing.members.push(member);
      } else {
        pendingClusters.set(signature, {
          label,
          members: [member],
          excerpt,
        });
      }
    }
    // "name-only": the full row was over budget and the harness degraded to
    // name-only - no cluster is queued, so this failure's annotation (below)
    // must not promise a detail block that will never exist.
    // "none": neither candidate fit - no row at all was recorded, so the
    // annotation must not name the label as a summary target either.

    // Failure annotation — navigation only, and only when the
    // harness owns the step. The budget is step-wide (sidecar
    // counter file — module state is per test FILE, see the scope
    // warning at the top); the failure that crosses the cap emits
    // the single aggregate as the step's 10th and last annotation.
    // The message is trimmed (the full output is in the summary on
    // the same page) and the title carries the label so annotations
    // cross-reference their summary entry.
    if (harnessOwnsStep()) {
      if (decision.emitAnnotation) {
        ghError(annotationBody(repro, annotationExcerpt, label, rowOutcome), {
          file: annotationFile,
          title: `${label} · ${ctx.testName}`,
        });
      } else if (decision.emitAggregate) {
        ghError(
          "Further test failures are not annotated (GitHub caps " +
            "annotations per step) — see the step log for " +
            "the complete list",
          { title: "More test failures" },
        );
      }
    }
  } catch {
    // Reporting is diagnostics. A failing counter or summary write must
    // never stand in for the failure being reported.
  }
}

export function test(test: TestDescriptor) {
  // Phase 2.1: open this file's group now, at registration time, so Deno's
  // "running N tests from" and announcement lines land inside it. Once per file
  // (registrationGroupAttempted), gated on harnessOwnsStep() so local and
  // orchestrated (bucket) runs do no stack resolution and stay byte-identical.
  if (!registrationGroupAttempted && harnessOwnsStep()) {
    registrationGroupAttempted = true;
    const file = testFileFromStack();
    if (file !== undefined) {
      enterTestFileGroup(file);
    }
  }

  const testName = test.context.name
    ? `[${test.type}] > ${test.name} (${test.context.name})`
    : `[${test.type}] > ${test.name}`;

  const sanitizeResources = test.context.sanitize?.resources;
  const sanitizeOps = test.context.sanitize?.ops;
  const sanitizeExit = test.context.sanitize?.exit;
  const ignore = test.context.ignore ||
    (isBinaryMode() && test.context.requiresDevQuarto);
  const userSession = !runningInCI();

  const args: Deno.TestDefinition = {
    name: testName,
    async fn(context) {
      // GitHub Actions per-file log grouping (Phase 2 of
      // dev-docs/ci-test-log-grouping-design.md): open (or transition to) the
      // group for this test's declaring file before any output. Gated on
      // harnessOwnsStep() so local and orchestrated (bucket) runs do no origin
      // resolution and stay byte-identical; enterTestFileGroup re-checks the
      // gate for its other caller.
      if (harnessOwnsStep()) {
        enterTestFileGroup(
          testFileFromOrigin(context.origin).relPath.replaceAll("\\", "/"),
        );
      }
      // Taken before anything can throw, so a lifecycle failure still has a
      // duration to report.
      const testStart = performance.now();
      // Failure state for the whole body: collected here, reported once from
      // the outer catch, after teardown.
      let primary: PrimaryFailure | undefined;
      // Set from either the cleanup steps below or teardown - whichever
      // throws first - so both still leave exactly one record.
      let finallyFailure: Thrown | undefined;
      try {
        await initDenoDom();
        const runTest = !test.context.prereq || await test.context.prereq();
        if (runTest) {
          const wd = Deno.cwd();

          // The child owns log capture in binary mode.
          const binMode = isBinaryMode();

          let cleanedup = false;
          const cleanupLogOnce = async () => {
            if (!cleanedup && !binMode) {
              await cleanupLogger();
              cleanedup = true;
            }
          };

          let log: string | undefined;
          let logTarget: string | undefined;
          let handlers:
            | Awaited<ReturnType<typeof initializeLogger>>
            | undefined;

          const logOutput = (path?: string) => {
            if (path && existsSync(path)) {
              return readExecuteOutput(path);
            } else {
              return undefined;
            }
          };
          let lastVerify;
          // The decorated console block for a failure in this scope; thrown
          // by fail() once teardown has run.
          let failureOutput: string | undefined;

          try {
            // Keep setup and cwd changes inside the cleanup scope.
            if (test.context?.cwd) {
              Deno.chdir(test.context.cwd());
            }

            if (test.context.setup) {
              await test.context.setup();
            }

            // Capture the output. Started only after setup, so a setup that
            // renders its own baseline (e.g. building a freeze cache) doesn't
            // attribute its output to the execute() run that verify() inspects.
            log = Deno.makeTempFileSync({ suffix: ".json" });
            logTarget = test.logConfig?.log || log;
            handlers = binMode ? undefined : await initializeLogger({
              log: logTarget,
              level: test.logConfig?.level || "INFO",
              format: test.logConfig?.format || "json-stream",
              quiet: true,
            });

            try {
              await test.execute(logTarget);
            } catch (e) {
              if (binMode) {
                // Append directly because binary mode has no harness logger.
                const message = e instanceof Error
                  ? `${e.message}\n${e.stack ?? ""}`
                  : String(e);
                appendLogError(logTarget, message);
              } else {
                logError(e);
              }
            }

            // Cleanup the output logging
            await cleanupLogOnce();

            if (handlers) {
              flushLoggers(handlers);
            }

            // Both logging modes write to logTarget; a missing log is a failure.
            const testOutput = logOutput(logTarget);
            if (testOutput === undefined) {
              fail(`test log file is missing: ${logTarget}`);
            } else {
              for (const ver of test.verify) {
                lastVerify = ver;
                if (userSession) {
                  const verifyMsg = "[verify] > " + ver.name;
                  console.log(userSession ? colors.dim(verifyMsg) : verifyMsg);
                }
                await ver.verify(testOutput);
              }
            }
          } catch (ex) {
            // Pop out of the per-file group BEFORE teardown runs and before
            // the ::error annotation, so teardown output, the annotation, the
            // FAILED result line, and the end-of-run failure detail all land
            // outside any collapsed group (Phase 2, spike-verified). The next
            // test re-opens a group with the same file title.
            closeTestFileGroup();

            const { message, stack } = describeThrow(ex);

            const border = "-".repeat(80);
            const coloredName = userSession
              ? colors.brightGreen(colors.italic(testName))
              : testName;

            // Compute an inset based upon the testName
            const offset = testName.indexOf(">");

            // Form the test runner command
            const { relPath } = testFileFromOrigin(context.origin);
            const command = isWindows ? "run-tests.ps1" : "./run-tests.sh";
            const testCommand = `${
              offset > 0 ? " ".repeat(offset + 2) : ""
            }${command} ${relPath}`;
            const coloredTestCommand = userSession
              ? colors.brightGreen(testCommand)
              : testCommand;

            const verifyFailed = `[verify] > ${
              lastVerify ? lastVerify.name : "unknown"
            }`;
            const coloredVerify = userSession
              ? colors.brightGreen(verifyFailed)
              : verifyFailed;

            // Preserve the primary failure if the log is malformed.
            let logMessages: ExecuteOutput[] | undefined;
            try {
              logMessages = logOutput(logTarget);
            } catch {
              logMessages = undefined;
            }

            // Create distinctive failure marker for easy log navigation
            // This helps users find the failure when clicking GitHub Actions annotations
            const failureMarker = `━━━ TEST FAILURE: ${testName}`;
            const coloredFailureMarker = userSession
              ? colors.red(colors.bold(failureMarker))
              : failureMarker;

            const output: string[] = [
              "",
              "",
              coloredFailureMarker,
              border,
              coloredName,
              coloredTestCommand,
              "",
              coloredVerify,
              "",
              message,
              stack,
              "",
            ];

            if (logMessages && logMessages.length > 0) {
              output.push("OUTPUT:");
              logMessages.forEach((out) => {
                const parts = out.msg.split("\n");
                parts.forEach((part) => {
                  output.push("    " + part);
                });
              });
            }

            primary = { value: ex, message, stack, logMessages };
            failureOutput = output.join("\n");
          } finally {
            // Guarded rather than bare: safeRemoveSync/cleanupLogOnce can
            // throw (a still-present file after a failed remove; a throwing
            // logger handler destroy), and a finally step that throws skips
            // everything after it - teardown would never run, and the cwd
            // restore below would never run either, leaking the process cwd
            // into every later test in the file. Captured rather than
            // propagated for the same reason a teardown throw is: it must
            // not REPLACE the failure already in flight. First failure in
            // this block wins the single report slot.
            try {
              if (log) {
                safeRemoveSync(log);
              }
            } catch (e) {
              finallyFailure ??= { value: e, phase: "cleanup" };
            }
            try {
              await cleanupLogOnce();
            } catch (e) {
              finallyFailure ??= { value: e, phase: "cleanup" };
            }
            // Restore the cwd even when teardown fails.
            try {
              if (test.context.teardown) {
                await test.context.teardown();
              }
            } catch (e) {
              finallyFailure ??= { value: e, phase: "teardown" };
            } finally {
              if (test.context?.cwd) {
                Deno.chdir(wd);
              }
            }
          }

          if (failureOutput !== undefined && finallyFailure === undefined) {
            fail(failureOutput);
          }
          if (finallyFailure !== undefined) {
            if (failureOutput === undefined) {
              throw finallyFailure.value;
            }
            // Both failures as ONE error, so Deno's output, the ::error
            // annotation and the step-summary row name the same two things.
            const combined = new AssertionError(
              `${failureOutput}\n\n${bannerFor(finallyFailure.phase)}\n${
                describeThrow(finallyFailure.value).message
              }`,
            );
            combined.cause = finallyFailure.value;
            throw combined;
          }
        } else {
          warning(`Skipped - ${test.name}`);
        }
      } catch (e) {
        // Close the per-file group before ANY failure propagates to Deno.
        // init/prereq/setup/teardown errors bypass the execute/verify
        // failure path (which closes it itself; close() is idempotent) and
        // would otherwise leave the FAILED result line inside a collapsed
        // group until the unload handler runs.
        closeTestFileGroup();
        if (primary === undefined && finallyFailure === undefined) {
          // A lifecycle failure (initDenoDom, prereq, logger init) never
          // reached the execute/verify catch, so it carries no captured
          // output.
          const { message, stack } = describeThrow(e);
          primary = { value: e, message, stack };
        }
        reportFailure(primary, finallyFailure, {
          testName,
          origin: context.origin,
          testStart,
        });
        throw e;
      }
    },
    ignore,
    sanitizeExit,
    sanitizeOps,
    sanitizeResources,
  };

  // work around 1.32.5 bug: https://github.com/denoland/deno/issues/18784
  if (args.ignore === undefined) {
    delete args.ignore;
  }
  Deno.test(args);
}

// Keep parsing strict; mergeChildLog() removes timeout-torn trailing records.
export function readExecuteOutput(log: string) {
  const jsonStream = Deno.readTextFileSync(log);
  const lines = jsonStream.split("\n").filter((line) => !!line);
  return lines.map((line) => {
    return JSON.parse(line) as ExecuteOutput;
  });
}
