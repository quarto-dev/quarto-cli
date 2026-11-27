/*
 * previewjs.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { join } from "../../../src/deno_ral/path.ts";
import { execPath, execSync } from "../../../src/deno_ral/process.ts";

export function buildQuartoPreviewJs(
  srcDir: string,
  denoDir?: string,
  force?: boolean,
) {
  const args = ["run", "--no-config", "-A", "build.ts"];
  if (force) {
    args.push("--force");
  }
  return execSync(execPath(), {
    args,
    cwd: quartoPreviewJsDir(srcDir),
    env: denoDir ? { DENO_DIR: denoDir } : undefined,
    stderr: "inherit",
    stdout: "inherit",
  });
}

export function quartoPreviewJsDir(srcDir: string) {
  return join(srcDir, "webui", "quarto-preview");
}
