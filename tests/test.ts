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
  annotationBody,
  AnnotationBudget,
  appendStepSummaryBounded,
  appendStepSummaryFirstFit,
  error as ghError,
  excerptSignature,
  type FailureCluster,
  failureLabel,
  harnessOwnsStep,
  isGitHubActions,
  kAnnotationExcerptLines,
  kExcerptMaxBytes,
  stripAnsi,
  summaryClusterBlock,
  type SummaryRowOutcome,
  summaryTableHeader,
  summaryTableRow,
  summaryTableRowNameOnly,
  truncateUtf8Bytes,
} from "../src/tools/github.ts";
import {
  closeTestFileGroup,
  enterTestFileGroup,
  testFileUrlFromStack,
} from "./gha-grouping.ts";

// GitHub Actions reporting. Deno evaluates this module once per test file, so
// module state is per file; AnnotationBudget persists the step-wide count.
const kExcerptLines = 20;
// Reserve a separator, banner, and one secondary-failure line.
const kFinallyReservedLines = 3;
// Annotations omit the separator from their smaller line budget.
const kFinallyAnnotationReservedLines = 2;
const annotationBudget = new AnnotationBudget();
let summaryHeaderEmitted = false;
// Opening at registration includes Deno's file header in the group.
let registrationGroupAttempted = false;
// Detail blocks must follow all table rows, so queue per-file clusters.
const pendingClusters = new Map<string, FailureCluster>();

if (isGitHubActions()) {
  globalThis.addEventListener("unload", () => {
    // Keep the next file and Deno's final failure sections outside this group.
    closeTestFileGroup();
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

// Resolve an origin to an absolute path and a path relative to `tests/`.
// Bare `deno test` runs may lack QUARTO_BIN_PATH, so fall back to Deno.cwd().
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

// context.origin is unavailable during registration; use the first test-file
// stack frame. The test body later corrects or opens the authoritative group.
function testFileFromStack(): string | undefined {
  const url = testFileUrlFromStack(new Error().stack);
  if (url === undefined) return undefined;
  return testFileFromOrigin(url).relPath.replaceAll("\\", "/");
}

const kTeardownBanner = "TEARDOWN ALSO FAILED:";

const kCleanupBanner = "CLEANUP ALSO FAILED:";

function bannerFor(phase: "teardown" | "cleanup"): string {
  return phase === "teardown" ? kTeardownBanner : kCleanupBanner;
}

// Tests may throw values other than Error.
function describeThrow(value: unknown): { message: string; stack: string } {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack ?? "" };
  }
  return { message: String(value), stack: "" };
}

// Boxing preserves a thrown `undefined` and identifies the failing phase.
interface Thrown {
  value: unknown;
  phase: "teardown" | "cleanup";
}

interface PrimaryFailure {
  value: unknown;
  message: string;
  stack: string;
  logMessages?: ExecuteOutput[];
}

interface FailureContext {
  testName: string;
  origin: string;
  testStart: number;
}

// Report once after teardown. Diagnostics are best-effort and must not replace
// the test failure already in flight.
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
    // Smoke-all failures should navigate to the document, not the harness.
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
      // Cap bytes before lines so the truncation marker uses a reserved line.
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
      // A teardown-only failure needs its own source location.
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
    const excerpt = truncateUtf8Bytes(
      stripAnsi(rawExcerpt.join("\n"))
        .split("\n")
        .slice(0, kExcerptLines)
        .join("\n"),
      kExcerptMaxBytes,
    );

    // Use a smaller reserved excerpt so annotations retain secondary failures.
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

    // All CI paths need a step-wide ordinal for summary navigation.
    const decision = annotationBudget.recordFailure();
    const label = failureLabel(
      decision.ordinal,
      Deno.env.get("RUNNER_OS") ?? "",
      Deno.env.get("QUARTO_TESTS_GHA_LABEL_TAG") ?? "",
    );

    // Rows take priority over detail blocks and degrade before being dropped.
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
    // Bucket loops own their annotations; full runs use the harness budget.
    if (harnessOwnsStep()) {
      if (decision.emitAnnotation) {
        ghError(annotationBody(repro, annotationExcerpt, label, rowOutcome), {
          file: annotationFile,
          title: `${label} · ${ctx.testName}`,
        });
      } else if (decision.emitAggregate) {
        ghError(
          "Additional failures were not annotated because GitHub limits " +
            "annotations per step. See the step log for all failures.",
          { title: "More test failures" },
        );
      }
    }
  } catch {
    // Preserve the original failure.
  }
}

export function test(test: TestDescriptor) {
  // Open early enough to include Deno's file header.
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
      // Correct or open the group from the authoritative test origin.
      if (harnessOwnsStep()) {
        enterTestFileGroup(
          testFileFromOrigin(context.origin).relPath.replaceAll("\\", "/"),
        );
      }
      // Start timing before lifecycle hooks can fail.
      const testStart = performance.now();
      let primary: PrimaryFailure | undefined;
      // Keep the first cleanup or teardown failure.
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
          // Delay the decorated failure until teardown has run.
          let failureOutput: string | undefined;

          try {
            // Keep setup and cwd changes inside the finalization scope.
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
            // Keep teardown, annotations, and failure output visible.
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

            // Add a stable log navigation marker.
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
            // Capture cleanup failures so teardown and cwd restoration still run.
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
            // Restore cwd even when teardown fails.
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
            // Report the primary and finalization failures together.
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
        // Lifecycle failures can bypass the inner close.
        closeTestFileGroup();
        if (primary === undefined && finallyFailure === undefined) {
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
