/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";

import { VerifyRender } from "./verify.ts";
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
