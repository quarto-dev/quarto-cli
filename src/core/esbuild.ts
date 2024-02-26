/*
 * esbuild.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { execProcess } from "./process.ts";
import { architectureToolsPath } from "./resources.ts";

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
  const result = await execProcess(
    Deno.env.get("QUARTO_ESBUILD") || architectureToolsPath("esbuild"),
    {
      args,
      cwd: workingDir,
      stdout: "piped",
    },
    input,
  );

  if (result.success) {
    return result.stdout;
  } else {
    throw new Error("esbuild command failed");
  }
}
