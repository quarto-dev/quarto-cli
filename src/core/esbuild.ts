/*
 * esbuild.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { assert } from "testing/asserts";
import { execProcess } from "./process.ts";
import { architectureToolsPath } from "./resources.ts";
import { TempContext } from "./temp-types.ts";
import { createTempContext } from "./temp.ts";
import { nullDevice } from "./platform.ts";

type ESBuildAnalysisImport = {
  path: string;
  kind: string;
  external: boolean;
};

type ESBuildOutputValue = {
  imports: ESBuildAnalysisImport[];
  entryPoint: string;
  inputs: Record<string, { bytesInOutput: number }>;
  bytes: number;
};

export type ESBuildAnalysis = {
  inputs: Record<string, { bytes: number; format: string }>;
  outputs: Record<string, ESBuildOutputValue>;
};

export async function esbuildAnalyze(
  input: string,
  workingDir: string,
  tempContext?: TempContext,
): Promise<ESBuildAnalysis> {
  let mustCleanup = false;
  if (!tempContext) {
    tempContext = createTempContext();
    mustCleanup = true;
  }

  try {
    const tempName = tempContext.createFile({ suffix: ".json" });
    await esbuildCommand(
      [
        "--analyze=verbose",
        `--metafile=${tempName}`,
        `--outfile=${nullDevice()}`,
        input,
      ],
      "",
      workingDir,
    );
    const result = JSON.parse(
      Deno.readTextFileSync(tempName),
    ) as ESBuildAnalysis;
    assert(Object.entries(result.outputs).length === 1);
    result.outputs = {
      "<output>": Object.values(result.outputs)[0],
    };
    return result;
  } finally {
    if (mustCleanup) {
      tempContext.cleanup();
    }
  }
}

export async function esbuildCompile(
  input: string,
  workingDir: string,
  args?: string[],
  format?: "esm" | "cjs" | "iife",
): Promise<string | undefined> {
  format = format ?? "esm";
  const fullArgs = [
    "--bundle",
    `--format=${format}`,
    ...(args || []),
  ];

  return await esbuildCommand(fullArgs, input, workingDir);
}

export async function esbuildCommand(
  args: string[],
  input: string,
  workingDir: string,
) {
  const cmd = Deno.env.get("QUARTO_ESBUILD") ||
    architectureToolsPath("esbuild");
  const result = await execProcess(
    {
      cmd,
      args,
      cwd: workingDir,
      stdout: "piped",
      stderr: "piped",
    },
    input,
  );

  if (result.success) {
    return result.stdout;
  } else {
    console.error(result.stderr);

    throw new Error("esbuild command failed");
  }
}
