/*
* test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { existsSync, safeRemoveSync } from "../src/deno_ral/fs.ts";
import { AssertionError, fail } from "testing/asserts";
import { warning } from "../src/deno_ral/log.ts";
import { initDenoDom } from "../src/core/deno-dom.ts";

import { cleanupLogger, initializeLogger, flushLoggers, logError, LogLevel, LogFormat } from "../src/core/log.ts";
import { appendLogError, isBinaryMode, runQuarto } from "./quarto-cmd.ts";
import { join } from "../src/deno_ral/path.ts";
import * as colors from "fmt/colors";
import { runningInCI } from "../src/core/ci-info.ts";
import { relative, fromFileUrl } from "../src/deno_ral/path.ts";
import { quartoConfig } from "../src/core/quarto.ts";
import { isWindows } from "../src/deno_ral/platform.ts";
import {
  AnnotationBudget,
  error as ghError,
  harnessOwnsStep,
  isGitHubActions,
  kStepSummaryBudgetBytes,
  stepSummary,
  stepSummarySize,
  stripAnsi,
  summaryDetailBlock,
  summaryTableHeader,
  summaryTableRow,
  summaryTableRowNameOnly,
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
// at its unload event.
const pendingSummaryDetails: string[] = [];

if (isGitHubActions()) {
  globalThis.addEventListener("unload", () => {
    // Fires at the end of EACH test file's module instance. Close this
    // file's group if still open — this is what ends a passing file's group
    // before the next file starts, and keeps Deno's terminal
    // ERRORS/FAILURES/summary sections outside any group (Phase 2). No-op
    // unless the harness owns the step.
    closeTestFileGroup();
    // Flush this file's buffered detail blocks after its row table,
    // stopping if the shared summary file crosses the size budget.
    for (const detail of pendingSummaryDetails) {
      if (stepSummarySize() > kStepSummaryBudgetBytes) break;
      stepSummary(detail);
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

  // Executes the test. In binary mode (QUARTO_TEST_BIN) the harness passes
  // the json-stream log file path so the spawned quarto can write it.
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
  // - Throws/rejects: Test is SKIPPED (initialization failed gracefully)
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

  // Marks a test that exercises quarto internals in-process and therefore
  // cannot run against an external built binary. Such tests are ignored
  // when QUARTO_TEST_BIN is set. Use sparingly — most tests should go
  // through testQuartoCmd/runQuarto and work in both modes.
  requiresDevQuarto?: boolean;
}

// Allow to merge test contexts in Tests helpers
export function mergeTestContexts(baseContext: TestContext, additionalContext?: TestContext): TestContext {
  if (!additionalContext) {
    return baseContext;
  }

  return {
    // override name if provided
    name: additionalContext.name || baseContext.name,
    // combine prereq conditions
    prereq: async () => {
      const baseResult = !baseContext.prereq || await baseContext.prereq();
      const additionalResult = !additionalContext.prereq || await additionalContext.prereq();
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
      resources: additionalContext.sanitize?.resources ?? baseContext.sanitize?.resources,
      ops: additionalContext.sanitize?.ops ?? baseContext.sanitize?.ops,
      exit: additionalContext.sanitize?.exit ?? baseContext.sanitize?.exit,
    },
    // override ignore if provided
    ignore: additionalContext.ignore ?? baseContext.ignore,
    // override requiresDevQuarto if provided
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
        // failures must reach the verifiers as log records, not exceptions
        // (mirrors the historical catch-and-log behavior in test())
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
            setTimeout(() => reject(new AssertionError(`timed out after 2 minutes. Something may be wrong with verify function in the test '${name}'.`)), 120000);
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
function testFileFromOrigin(origin: string): {
  absPath: string;
  relPath: string;
} {
  const absPath = isWindows
    ? fromFileUrl(origin)
    : (new URL(origin)).pathname;
  const quartoRoot = join(quartoConfig.binPath(), "..", "..", "..");
  const relPath = relative(join(quartoRoot, "tests"), absPath);
  return { absPath, relPath };
}

// Resolve the registering test file at registration (module-eval) time, when
// there is no context.origin yet, by walking the current call stack (Phase
// 2.1). testFileUrlFromStack picks the first `.test.ts` frame — the file whose
// top-level test() call is running — and testFileFromOrigin turns that URL into
// the tests-relative forward-slash path. Returns undefined when the stack
// cannot be parsed; the body-time enterTestFileGroup(origin) then opens (or
// transitions to) the correct group, so a missed guess is only a lost early
// open, never a wrong or duplicated group.
function testFileFromStack(): string | undefined {
  const url = testFileUrlFromStack(new Error().stack);
  if (url === undefined) return undefined;
  return testFileFromOrigin(url).relPath.replaceAll("\\", "/");
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
  // dev-only tests are ignored when targeting an external built binary
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
      try {
        const testStart = performance.now();
        await initDenoDom();
        const runTest = !test.context.prereq || await test.context.prereq();
        if (runTest) {
          const wd = Deno.cwd();
          if (test.context?.cwd) {
            Deno.chdir(test.context.cwd());
          }

          if (test.context.setup) {
            await test.context.setup();
          }

          // In binary mode the spawned quarto owns the log file; the harness
          // must not initialize (or later destroy) its own logger for
          // capture — cleanupLogger() would permanently tear down the
          // default handlers for subsequent tests in this process.
          const binMode = isBinaryMode();

          let cleanedup = false;
          const cleanupLogOnce = async () => {
            if (!cleanedup && !binMode) {
              await cleanupLogger();
              cleanedup = true;
            }
          };

          // Capture the output
          const log = Deno.makeTempFileSync({ suffix: ".json" });
          const logTarget = test.logConfig?.log || log;
          const handlers = binMode ? undefined : await initializeLogger({
            log: logTarget,
            level: test.logConfig?.level || "INFO",
            format: test.logConfig?.format || "json-stream",
            quiet: true,
          });

          const logOutput = (path: string) => {
            if (existsSync(path)) {
              return readExecuteOutput(path);
            } else {
              return undefined;
            }
          };
          let lastVerify;

          try {

            try {
              await test.execute(logTarget);
            } catch (e) {
              if (binMode) {
                // no harness logger in binary mode — append the failure to
                // the log file directly so verifiers (and the failure
                // report) still see it
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

            // Read the output. Verifiers must read logTarget - the harness
            // logger and the binary-mode child both write there; reading the
            // temp file would hand every log verifier an empty array whenever
            // logConfig.log is set. And a missing log is a FAILURE - skipping
            // verification would pass the test without checking anything.
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
            if (!(ex instanceof Error)) throw ex;

            // Pop out of the per-file group BEFORE emitting the ::error
            // annotation and throwing, so the annotation, the FAILED result
            // line, and the end-of-run failure detail all land outside any
            // collapsed group (Phase 2, spike-verified). The next test re-opens
            // a group with the same file title.
            closeTestFileGroup();

            const border = "-".repeat(80);
            const coloredName = userSession
              ? colors.brightGreen(colors.italic(testName))
              : testName;

            // Compute an inset based upon the testName
            const offset = testName.indexOf(">");

            // Form the test runner command
            const { absPath, relPath } = testFileFromOrigin(context.origin);
            const command = isWindows
              ? "run-tests.ps1"
              : "./run-tests.sh";
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

            // guarded: a corrupt/unparseable log must not clobber the
            // assembled failure report with a secondary parse error
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
              ex.message,
              ex.stack ?? "",
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

            // GitHub Actions: a failure annotation (navigation) and a
            // step-summary row (the complete failure record). No-op off CI.
            if (isGitHubActions()) {
              const fwd = (p: string) => p.replaceAll("\\", "/");
              // The repro path is tests-relative (run-tests.sh runs from
              // tests/); the annotation file= is repo-relative with forward
              // slashes. For smoke-all doc tests the navigable file is the
              // rendered document (embedded in the test name by
              // smoke-all.test.ts), not the harness .test.ts file.
              let reproPath = fwd(relPath);
              if (fwd(absPath).endsWith("/smoke/smoke-all.test.ts")) {
                const m = fwd(testName).match(
                  /(\S+\.(?:qmd|ipynb|md))(?=\s|$)/,
                );
                if (m) {
                  reproPath = m[1];
                }
              }
              const annotationFile = `tests/${reproPath}`;
              const repro = `${command} ${reproPath}`;

              const rawExcerpt: string[] = [ex.message];
              if (ex.stack) {
                rawExcerpt.push(ex.stack);
              }
              if (logMessages && logMessages.length > 0) {
                rawExcerpt.push("OUTPUT:");
                for (const out of logMessages) {
                  for (const part of out.msg.split("\n")) {
                    rawExcerpt.push("    " + part);
                  }
                }
              }
              const excerpt = stripAnsi(rawExcerpt.join("\n"))
                .split("\n")
                .slice(0, kExcerptLines)
                .join("\n");

              // Step-summary row — emitted in ALL modes (cap-free, size-
              // coordinated via the file). Degrade to name-only once the
              // shared file is over budget.
              const overBudget = stepSummarySize() > kStepSummaryBudgetBytes;
              if (!summaryHeaderEmitted) {
                stepSummary(summaryTableHeader());
                summaryHeaderEmitted = true;
              }
              if (overBudget) {
                stepSummary(summaryTableRowNameOnly(annotationFile, testName));
              } else {
                const durationMs = Math.round(performance.now() - testStart);
                stepSummary(
                  summaryTableRow(annotationFile, testName, durationMs),
                );
                pendingSummaryDetails.push(
                  summaryDetailBlock(annotationFile, testName, repro, excerpt),
                );
              }

              // Failure annotation — navigation only, and only when the
              // harness owns the step. The budget is step-wide (sidecar
              // counter file — module state is per test FILE, see the scope
              // warning at the top); the failure that crosses the cap emits
              // the single aggregate as the step's 10th and last annotation.
              if (harnessOwnsStep()) {
                const decision = annotationBudget.recordFailure();
                if (decision.emitAnnotation) {
                  ghError(`${repro}\n\n${excerpt}`, {
                    file: annotationFile,
                    title: testName,
                  });
                } else if (decision.emitAggregate) {
                  ghError(
                    "Further test failures are not annotated (GitHub caps " +
                      "annotations per step) — see the step summary for " +
                      "the complete list",
                    { title: "More test failures" },
                  );
                }
              }
            }

            fail(output.join("\n"));
          } finally {
            safeRemoveSync(log);
            await cleanupLogOnce();
            if (test.context.teardown) {
              await test.context.teardown();
            }

            if (test.context?.cwd) {
              Deno.chdir(wd);
            }
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

// Strict on purpose: a JSON.parse throw is how log-level-and-formats.test.ts
// detects that quarto emitted malformed JSON-stream output. A timeout-killed
// built quarto can leave a torn final line, but that is stripped at the source
// in mergeChildLog (tests/quarto-cmd.ts) so the merged log stays valid here.
export function readExecuteOutput(log: string) {
  const jsonStream = Deno.readTextFileSync(log);
  const lines = jsonStream.split("\n").filter((line) => !!line);
  return lines.map((line) => {
    return JSON.parse(line) as ExecuteOutput;
  });
}
