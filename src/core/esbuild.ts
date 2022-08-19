/*
* esbuild.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { execProcess } from "./process.ts";
import { toolsPath } from "./resources.ts";

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
  const cmd = [
    Deno.env.get("QUARTO_ESBUILD") || toolsPath("esbuild"),
    ...args,
  ];

  const result = await execProcess(
    {
      cmd,
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
