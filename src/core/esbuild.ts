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
): Promise<string | undefined> {
  const args = [
    "--bundle",
    "--format=esm",
  ];

  return await esbuildCommand(args, input, workingDir);
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
