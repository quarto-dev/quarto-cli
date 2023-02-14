/*
* render.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { basename, join } from "path/mod.ts";

import { outputForInput } from "../../utils.ts";
import { TestContext, testQuartoCmd, Verify } from "../../test.ts";
import {
  ensureFileRegexMatches,
  hasSupportingFiles,
  noSupportingFiles,
  outputCreated,
} from "../../verify.ts";

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
) {
  // Verify that the output was created and
  // that supporting files are present or missing
  const verify: Verify[] = [];
  if (!input.endsWith("/")) {
    verify.push(outputCreated(input, to));
    if (noSupporting) {
      verify.push(noSupportingFiles(input, to));
    } else {
      verify.push(hasSupportingFiles(input, to));
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
      teardown: async () => {
        if (context?.teardown) {
          await context?.teardown();
        }
        cleanoutput(input, to);
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
