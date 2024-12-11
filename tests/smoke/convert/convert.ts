/*
* convert.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { assert } from "testing/asserts";

import { outputForInput } from "../../utils.ts";
import {
  ExecuteOutput,
  TestContext,
  testQuartoCmd,
  Verify,
} from "../../test.ts";
import { verifyPath } from "../../verify.ts";

const outputConverted = (input: string, to: string): Verify => {
  return {
    name: "Output Converted",
    verify: (outputs: ExecuteOutput[]) => {
      // Check for output converted message
      const outputCreatedMsg = outputs.find((outMsg) =>
        outMsg.msg.startsWith("Converted to")
      );
      assert(outputCreatedMsg !== undefined, "No output convertsion message");

      // Check for existence of the output
      const outputFile = outputForInput(input, to);
      verifyPath(outputFile.outputPath);
      return Promise.resolve();
    },
  };
};

// currently only converts to ipynb
export function testConvert(
  input: string,
  addtlVerify?: Verify[],
  context?: TestContext,
  args?: string[],
) {
  // Verify that the output was created and
  // that supporting files are present or missing
  const verify: Verify[] = [];

  if (!input.endsWith("/")) {
    verify.push(outputConverted(input, "ipynb"));
  }
  if (addtlVerify) {
    verify.push(...addtlVerify);
  }
  context = context || {};

  // Run the command
  testQuartoCmd(
    "convert",
    [input, ...(args || [])],
    verify,
    {
      ...context,
      teardown: async () => {
        if (context?.teardown) {
          await context?.teardown();
        }
        cleanoutput(input, "ipynb");
      },
    },
  );
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
