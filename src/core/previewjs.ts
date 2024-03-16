/*
 * previewjs.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { join } from "../deno_ral/path.ts";

export function buildQuartoPreviewJs(
  srcDir: string,
  denoDir?: string,
  force?: boolean,
) {
  const args = ["run", "-A", "build.ts"];
  if (force) {
    args.push("--force");
  }
  const buildCmd = new Deno.Command(Deno.execPath(), {
    args: args,
    cwd: quartoPreviewJsDir(srcDir),
    env: denoDir ? { DENO_DIR: denoDir } : undefined,
    stderr: "inherit",
    stdout: "inherit",
  });
  return buildCmd.outputSync();
}

export function quartoPreviewJsDir(srcDir: string) {
  return join(srcDir, "webui", "quarto-preview");
}
