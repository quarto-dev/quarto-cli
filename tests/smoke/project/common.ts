/*
* common.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { join, dirname } from "../../../src/deno_ral/path.ts";
import { Verify, testQuartoCmd } from "../../test.ts";
import { outputForInput } from "../../utils.ts";
import { fileExists, noErrorsOrWarnings, noSupportingFiles } from "../../verify.ts";

export const kProjectWorkingDir = "simple-test";
export const kQuartoProjectFile = join(kProjectWorkingDir, "_quarto.yml");

export async function cleanWorking() {
  if (existsSync(kProjectWorkingDir)) {
    await Deno.remove(kProjectWorkingDir, { recursive: true });
  }
}

export type OutputVerify = (outputDir: string) => Verify[];

export const testProjectRender = (
  input: string,
  to: string,
  outputDir: string,
  outputVerify: OutputVerify
) => {

  const output = outputForInput(input, to, outputDir);
  const outDir = dirname(output.outputPath);
  const outVerify = outputVerify(outDir);

  const verifyTests = [noErrorsOrWarnings, fileExists(output.supportPath)];
  verifyTests.push(...outVerify);

  // Run the command
  testQuartoCmd(
    "render",
    [input],
    verifyTests,
    {
      teardown: async () => {
        const siteDir = dirname(output.outputPath);
        if (existsSync(siteDir)) {
          await Deno.remove(siteDir, { recursive: true });
        }
      },
    },
  );
};
