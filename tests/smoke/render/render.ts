/*
* render.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { basename, join } from "../../../src/deno_ral/path.ts";

import { outputForInput } from "../../utils.ts";
import { TestContext, testQuartoCmd, Verify } from "../../test.ts";
import {
  ensureFileRegexMatches,
  hasSupportingFiles,
  noSupportingFiles,
  outputCreated,
} from "../../verify.ts";
import { safeRemoveSync } from "../../../src/core/path.ts";
import { safeExistsSync } from "../../../src/core/path.ts";
import { assert } from "testing/asserts";

export function testSimpleIsolatedRender(
  file: string,
  to: string,
  noSupporting: boolean,
) {
  const dir = Deno.makeTempDirSync();
  const tempInput = join(dir, basename(file));
  Deno.copyFileSync(file, tempInput);
  testRender(tempInput, to, noSupporting, [], {
    teardown: () => {
      return Deno.remove(dir, { recursive: true });
    },
  });
}

export function testRender(
  input: string,
  to: string,
  noSupporting: boolean,
  addtlVerify?: Verify[],
  context?: TestContext,
  args?: string[],
  projectOutDir?: string
) {
  // Verify that the output was created and
  // that supporting files are present or missing
  const verify: Verify[] = [];
  // If we're not rendering a folder but a single document, add some more assertions
  if (!input.match(/[\\/]$/)) {
    verify.push(outputCreated(input, to, projectOutDir));
    if (noSupporting) {
      verify.push(noSupportingFiles(input, to, projectOutDir));
    } else {
      verify.push(hasSupportingFiles(input, to, projectOutDir));
    }
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
    {
      ...context,
      setup: async () => {
        if (context?.setup) {
          await context?.setup();
        }
        assert(safeExistsSync(input), `Input file ${input} does not exist. Test could not be ran.`);
      },
      teardown: async () => {
        if (context?.teardown) {
          await context?.teardown();
        }
        cleanoutput(input, to);
      },
    },
  );
}

export function cleanoutput(
  input: string, 
  to: string, 
  projectOutDir?: string,
  projectRoot?: string,
  // deno-lint-ignore no-explicit-any
  metadata?: Record<string, any>,
) {
  const out = outputForInput(input, to, projectOutDir, projectRoot, metadata);
  if (safeExistsSync(out.outputPath)) {
    safeRemoveSync(out.outputPath);
  }
  if (safeExistsSync(out.supportPath)) {
    safeRemoveSync(out.supportPath, { recursive: true });
  }
}

export const renderVerifyLatexOutput = (
  input: string,
  matches: RegExp[],
  noMatches?: RegExp[],
) => {
  const teXOutput = outputForInput(input, "latex");
  testRender(input, "latex", true, [
    ensureFileRegexMatches(teXOutput.outputPath, matches, noMatches),
  ]);
};
