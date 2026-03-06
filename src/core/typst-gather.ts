/*
 * typst-gather.ts
 *
 * Shared infrastructure for typst-gather binary integration.
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { existsSync } from "../deno_ral/fs.ts";
import { isWindows } from "../deno_ral/platform.ts";
import { architectureToolsPath } from "./resources.ts";
import { execProcess } from "./process.ts";

// Convert path to use forward slashes for TOML compatibility
// TOML treats backslash as escape character, so Windows paths must use forward slashes
export function toTomlPath(p: string): string {
  return p.replace(/\\/g, "/");
}

export interface AnalyzeImport {
  namespace: string;
  name: string;
  version: string;
  source: string;
  direct: boolean;
}

export interface AnalyzeResult {
  imports: AnalyzeImport[];
  files: string[];
}

export function typstGatherBinaryPath(): string {
  const binaryName = isWindows ? "typst-gather.exe" : "typst-gather";
  const binary = Deno.env.get("QUARTO_TYPST_GATHER") ||
    architectureToolsPath(binaryName);

  if (!existsSync(binary)) {
    throw new Error(
      `typst-gather binary not found.\n` +
        `Run ./configure.sh to build and install it.`,
    );
  }

  return binary;
}

export async function runAnalyze(tomlConfig: string): Promise<AnalyzeResult> {
  const binary = typstGatherBinaryPath();

  const result = await execProcess(
    {
      cmd: binary,
      args: ["analyze", "-"],
      stdout: "piped",
      stderr: "piped",
    },
    tomlConfig,
  );

  if (!result.success) {
    throw new Error(
      result.stderr || "typst-gather analyze failed",
    );
  }

  return JSON.parse(result.stdout!) as AnalyzeResult;
}
