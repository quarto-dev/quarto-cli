/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";

import { outputForInput } from "../utils.ts";
import { testQuartoCmd, Verify } from "../test.ts";
import {
  hasSupportingFiles,
  noSupportingFiles,
  outputCreated,
} from "../verify.ts";

export interface RenderTestContext {
  // Sets up the test
  setup?: () => Promise<void>;

  // Cleans up the test
  teardown?: () => Promise<void>;

  // Verifies that prerequisites are met
  prereq?: () => Promise<boolean>;
}

export function testRender(
  input: string,
  to: string,
  standalone: boolean,
  addtlVerify?: Verify[],
  context?: RenderTestContext,
  args?: string[],
) {
  // Verify that the output was created and
  // that supporting files are present or missing
  const verify: Verify[] = [];
  verify.push(outputCreated(input, to));
  if (standalone) {
    verify.push(noSupportingFiles(input, to));
  } else {
    verify.push(hasSupportingFiles(input, to));
  }
  if (addtlVerify) {
    verify.push(...addtlVerify);
  }
  context = context || {};

  // Run the command
  testQuartoCmd(
    "render",
    [input, "--to", to, ...(args || [])],
    verify,
    context.setup,
    async () => {
      if (context && context.teardown) {
        await context.teardown();
      }
      cleanoutput(input, to);
    },
    context.prereq,
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
