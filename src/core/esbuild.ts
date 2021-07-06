/*
* esbuild.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { execProcess } from "./process.ts";

export async function esbuildCompile(
  input: string,
  workingDir: string,
  args?: string[],
): Promise<string | undefined> {
  const fullArgs = [
    "--bundle",
    "--format=esm",
    ...(args || [])
  ];

  return await esbuildCommand(fullArgs, input, workingDir);
}

async function esbuildCommand(
  args: string[],
  input: string,
  workingDir: string,
) {
  const cmd = [
    "esbuild",
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
