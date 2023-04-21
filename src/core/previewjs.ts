/*
 * previewjs.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { join } from "path/mod.ts";

export function buildQuartoPreviewJs(srcDir: string, denoDir?: string) {
  const buildCmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "build.ts"],
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
