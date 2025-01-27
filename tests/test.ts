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

import { cleanupLogger, initializeLogger, flushLoggers, logError } from "../src/core/log.ts";
import { quarto } from "../src/quarto.ts";
import { join } from "../src/deno_ral/path.ts";
import * as colors from "fmt/colors";
import { runningInCI } from "../src/core/ci-info.ts";
import { relative, fromFileUrl } from "../src/deno_ral/path.ts";
import { quartoConfig } from "../src/core/quarto.ts";
import { isWindows } from "../src/deno_ral/platform.ts";

export interface TestDescriptor {
  // The name of the test
  name: string;

  // Sets up the test
  context: TestContext;

  // Executes the test
  execute: () => Promise<void>;

  // Used to verify the outcome of the test
  verify: Verify[];

  // type of test
  type: "smoke" | "unit";
}

export interface TestContext {
  name?: string;

  // Checks that prereqs for the test are met
  prereq?: () => Promise<boolean>;

  // Cleans up the test
  teardown?: () => Promise<void>;

  // Sets up the test
  setup?: () => Promise<void>;

  // Request that the test be run from another working directory
  cwd?: () => string;

  // Control of underlying sanitizer
  sanitize?: { resources?: boolean; ops?: boolean; exit?: boolean };

  // control if test is ran or skipped
  ignore?: boolean;

  // environment to pass to downstream processes
  env?: Record<string, string>;
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
    // merge env with additional context taking precedence
    env: { ...baseContext.env, ...additionalContext.env },
  };
}

export function testQuartoCmd(
  cmd: string,
  args: string[],
  verify: Verify[],
  context?: TestContext,
  name?: string
) {
  if (name === undefined) {
    name = `quarto ${cmd} ${args.join(" ")}`;
  }
  test({
    name,
    execute: async () => {
      const timeout = new Promise((_resolve, reject) => {
        setTimeout(reject, 600000, "timed out after 10 minutes");
      });
      await Promise.race([
        quarto([cmd, ...args], undefined, context?.env),
        timeout,
      ]);
    },
    verify,
    context: context || {},
    type: "smoke",
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

export function test(test: TestDescriptor) {
  const testName = test.context.name
    ? `[${test.type}] > ${test.name} (${test.context.name})`
    : `[${test.type}] > ${test.name}`;

  const sanitizeResources = test.context.sanitize?.resources;
  const sanitizeOps = test.context.sanitize?.ops;
  const sanitizeExit = test.context.sanitize?.exit;
  const ignore = test.context.ignore;
  const userSession = !runningInCI();

  const args: Deno.TestDefinition = {
    name: testName,
    async fn(context) {
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

        let cleanedup = false;
        const cleanupLogOnce = async () => {
          if (!cleanedup) {
            await cleanupLogger();
            cleanedup = true;
          }
        };

        // Capture the output
        const log = Deno.makeTempFileSync({ suffix: ".json" });
        const handlers = await initializeLogger({
          log: log,
          level: "INFO",
          format: "json-stream",
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
            await test.execute();
          } catch (e) {
            logError(e);
          }

          // Cleanup the output logging
          await cleanupLogOnce();

          flushLoggers(handlers);

          // Read the output
          const testOutput = logOutput(log);
          if (testOutput) {
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
          const border = "-".repeat(80);
          const coloredName = userSession
            ? colors.brightGreen(colors.italic(testName))
            : testName;

          // Compute an inset based upon the testName
          const offset = testName.indexOf(">");

          // Form the test runner command
          const absPath = isWindows
            ? fromFileUrl(context.origin)
            : (new URL(context.origin)).pathname;

          const quartoRoot = join(quartoConfig.binPath(), "..", "..", "..");
          const relPath = relative(
            join(quartoRoot, "tests"),
            absPath,
          );
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

          const logMessages = logOutput(log);
          const output: string[] = [
            "",
            "",
            border,
            coloredName,
            coloredTestCommand,
            "",
            coloredVerify,
            "",
            ex.message,
            ex.stack,
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

function readExecuteOutput(log: string) {
  const jsonStream = Deno.readTextFileSync(log);
  const lines = jsonStream.split("\n").filter((line) => !!line);
  return lines.map((line) => {
    return JSON.parse(line) as ExecuteOutput;
  });
}
