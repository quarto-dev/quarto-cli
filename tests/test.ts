// TODO: Create project tests
// TODO: test groups
// TODO: render-*.test.ts

import { existsSync } from "fs/mod.ts";
import { warning } from "log/mod.ts";

import { cleanupLogger, initializeLogger } from "../src/core/log.ts";
import { quarto } from "../src/quarto.ts";

/*
* test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
export interface TestDescriptor {
  // The name of the test
  name: string;

  // Sets up the test
  setup: () => Promise<void>;

  // Executes the test
  execute: () => Promise<void>;

  // Used to verify the outcome of the test
  verify: Verify[];

  // Cleans up the test
  teardown: () => Promise<void>;

  prereq?: () => Promise<boolean>;
}

export function testQuartoCmd(
  cmd: string,
  args: string[],
  verify: Verify[],
  setup?: () => Promise<void>,
  teardown?: () => Promise<void>,
  prereq?: () => Promise<boolean>,
) {
  const name = `$ quarto ${cmd} ${args.join(" ")}`;
  test({
    name,
    execute: async () => {
      await quarto([cmd, ...args]);
    },
    verify,
    setup: setup || (() => {
      return Promise.resolve();
    }),
    teardown: teardown || (() => {
      return Promise.resolve();
    }),
    prereq: prereq || (() => {
      return Promise.resolve(true);
    }),
  });
}

export interface Verify {
  name: string;
  verify: (outputs: ExecuteOutput[]) => void;
}

export interface ExecuteOutput {
  msg: string;
  level: number;
  levelName: string;
}

export function test(test: TestDescriptor) {
  Deno.test(test.name, async () => {
    const runTest = !test.prereq || await test.prereq();
    if (runTest) {
      await test.setup();

      // Capture the output
      const log = "test-out.json";
      await initializeLogger({
        log: log,
        level: "DEBUG",
        format: "json-stream",
        quiet: true,
      });

      await test.execute();

      // Cleanup the output loggin
      await cleanupLogger();

      // Read the output
      if (existsSync(log)) {
        const testOutput = readExecuteOutput(log);
        Deno.removeSync(log);

        test.verify.forEach((ver) => {
          ver.verify(testOutput);
        });
      }
      await test.teardown();
    } else {
      warning(`Skipped - ${test.name}`);
    }
  });
}

function readExecuteOutput(log: string) {
  const jsonStream = Deno.readTextFileSync(log);
  const lines = jsonStream.split("\n").filter((line) => !!line);
  return lines.map((line) => {
    return JSON.parse(line) as ExecuteOutput;
  });
}
