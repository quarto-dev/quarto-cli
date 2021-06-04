/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { assert } from "testing/asserts.ts";

import { verifyNoPath, verifyPath } from "./verify.ts";
import { outputForInput } from "./utils.ts";
import { ExecuteOutput, test } from "./test.ts";

import { quarto } from "../src/quarto.ts";

// Tests Rendering of Documents
export function testRender(
  input: string,
  to: string,
  verify: VerifyRender[],
  setup = async () => {},
  teardown = async () => {},
  prereq?: () => Promise<boolean>,
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
        verify: (output: ExecuteOutput[]) => {
          ver.verify(input, to, output);
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
    prereq,
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

export interface VerifyRender {
  name: string;
  verify: (input: string, to: string, output: ExecuteOutput[]) => void;
}

export const noSupportingFiles = {
  name: "No Supporting Files Dir",
  verify: (input: string, to: string, _output: ExecuteOutput[]) => {
    const outputFile = outputForInput(input, to);
    verifyNoPath(outputFile.supportPath);
  },
};

export const hasSupportingFiles = {
  name: "Has Supporting Files Dir",
  verify: (input: string, to: string, _output: ExecuteOutput[]) => {
    const outputFile = outputForInput(input, to);
    verifyPath(outputFile.supportPath);
  },
};

export const outputCreated = {
  name: "Output Created",
  verify: (input: string, to: string, output: ExecuteOutput[]) => {
    // Check for output created message
    const outputCreatedMsg = output.find((outMsg) =>
      outMsg.msg.startsWith("Output created:")
    );
    assert(outputCreatedMsg !== undefined, "No output created message");

    // Check for existence of the output
    const outputFile = outputForInput(input, to);
    verifyPath(outputFile.outputPath);
  },
};
