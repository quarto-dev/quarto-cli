/*
* test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { fail } from "testing/asserts.ts";
import { warning } from "log/mod.ts";
import { initDenoDom } from "../src/core/deno-dom.ts";

import { cleanupLogger, initializeLogger } from "../src/core/log.ts";
import { quarto } from "../src/quarto.ts";
import { join } from "path/mod.ts";
import * as colors from "fmt/colors.ts";
import { runningInCI } from "../src/core/ci-info.ts";
import { relative } from "path/mod.ts";
import { quartoConfig } from "../src/core/quarto.ts";

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
  santize?: { resources?: boolean; ops?: boolean; exit?: boolean };
}

export function testQuartoCmd(
  cmd: string,
  args: string[],
  verify: Verify[],
  context?: TestContext,
) {
  const name = `quarto ${cmd} ${args.join(" ")}`;
  test({
    name,
    execute: async () => {
      await quarto([cmd, ...args]);
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
) {
  test({
    name,
    type: "unit",
    context: {},
    execute: () => {
      return Promise.resolve();
    },
    verify: [
      {
        name: `${name}`,
        verify: async (_outputs: ExecuteOutput[]) => {
          await ver();
        },
      },
    ],
  });
}

export function test(test: TestDescriptor) {
  const testName = test.context.name
    ? `[${test.type}] > ${test.name} (${test.context.name})`
    : `[${test.type}] > ${test.name}`;

  const sanitizeResources = test.context.santize?.resources;
  const sanitizeOps = test.context.santize?.ops;
  const sanitizeExit = test.context.santize?.exit;

  Deno.test({
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
        const log = join(wd, "test-out.json");
        await initializeLogger({
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
          await test.execute();

          // Cleanup the output logging
          await cleanupLogOnce();

          // Read the output
          const testOutput = logOutput(log);
          if (testOutput) {
            for (const ver of test.verify) {
              lastVerify = ver;
              await ver.verify(testOutput);
            }
          }
        } catch (ex) {
          const colorize = !runningInCI();
          const border = "-".repeat(80);
          const coloredName = colorize
            ? colors.brightGreen(colors.italic(testName))
            : testName;

          // Compute an inset based upon the testName
          const offset = testName.indexOf(">");

          // Form the test runner command
          const originUrl = new URL(context.origin);
          const absPath = originUrl.pathname;

          const quartoRoot = join(quartoConfig.binPath(), "..", "..", "..");
          const relPath = relative(
            join(quartoRoot, "tests"),
            absPath,
          );
          const command = Deno.build.os === "windows"
            ? "run-tests.psl"
            : "./run-test.sh";
          const testCommand = `${
            offset > 0 ? " ".repeat(offset + 2) : ""
          }${command} ${relPath}`;
          const coloredTestCommand = colorize
            ? colors.brightGreen(testCommand)
            : testCommand;

          const verifyFailed = `[verify] > ${
            lastVerify ? lastVerify.name : "unknown"
          }`;
          const coloredVerify = colorize
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
          Deno.removeSync(log);
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
    sanitizeExit,
    sanitizeOps,
    sanitizeResources,
  });
}

function readExecuteOutput(log: string) {
  const jsonStream = Deno.readTextFileSync(log);
  const lines = jsonStream.split("\n").filter((line) => !!line);
  return lines.map((line) => {
    return JSON.parse(line) as ExecuteOutput;
  });
}
