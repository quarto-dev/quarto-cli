/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { VerifyRender } from "./verify.ts";
import { assertEquals } from "testing/asserts.ts";
import { outputForInput } from "./utils.ts";

import { existsSync } from "fs/mod.ts";
import { quarto } from "../src/quarto.ts";

export interface Verify {
  name: string;
  verify: () => void;
}

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
}

// Tests Rendering of Documents
export function testRender(
  input: string,
  to: string,
  verify: VerifyRender[],
  setup = async () => {},
  teardown = async () => {},
  args?: string[],
) {
  // Render Test Name
  const name = `Render: ${input} -> ${to}${
    args && args.length > 0 ? " (args:" + args.join(" ") + ")" : ""
  }`;

  // The Test itself
  test({
    name,
    verify: verify.map((ver) => {
      return {
        name: ver.name,
        verify: () => {
          ver.verify(input, to);
        },
      };
    }),
    setup,
    execute: async () => {
      // Run a Quarto render command and check its output
      const renderArgs = ["render", input];
      if (to) {
        renderArgs.push("--to");
        renderArgs.push(to);
      }
      if (args) {
        renderArgs.push(...args);
      }

      await quarto(renderArgs);
    },
    teardown: async () => {
      await teardown();
      cleanoutput(input, to);
    },
  });
}

function test(test: TestDescriptor) {
  Deno.test(test.name, async () => {
    await test.setup();
    await test.execute();
    test.verify.forEach((ver) => {
      ver.verify();
    });
    await test.teardown();
  });
}

export function cleanoutput(input: string, to: string) {
  const out = outputForInput(input, to);
  if (existsSync(out.outputPath)) {
    Deno.removeSync(out.outputPath);
  }
  if (existsSync(out.supportPath)) {
    Deno.removeSync(out.supportPath, { recursive: true });
  }
}
