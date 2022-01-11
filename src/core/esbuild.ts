/*
* esbuild.ts
*
* esbuild helpers
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { execProcess } from "./process.ts";
import { binaryPath, resourcePath } from "./resources.ts";
import { build } from "esbuild/mod.js";
import { cache } from "./lib/external/esbuild_plugin_cache/mod.ts";
import { createSessionTempDir } from "./temp.ts";

let esbuildCacheDir: string | undefined;
export function esbuild(
  args: Record<string, unknown>,
) {
  if (esbuildCacheDir === undefined) {
    esbuildCacheDir = createSessionTempDir();
  }
  const importmap = JSON.parse(
    Deno.readTextFileSync(resourcePath("../import_map.json")),
  );
  return build({
    bundle: true,
    format: "esm",
    ...args,
    plugins: [cache({
      importmap,
      directory: esbuildCacheDir,
    })],
  });
}

export async function esbuildCompile(
  input: string,
  workingDir: string,
  args?: string[],
  format?: "esm" | "iife",
): Promise<string | undefined> {
  format = format ?? "esm";
  const fullArgs = [
    "--bundle",
    `--format=${format}`,
    ...(args || []),
  ];

  return await esbuildCLI(fullArgs, input, workingDir);
}

async function esbuildCLI(
  args: string[],
  input: string,
  workingDir: string,
) {
  const cmd = [
    binaryPath("esbuild"),
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
