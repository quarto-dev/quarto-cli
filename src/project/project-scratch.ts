/*
 * project-scratch.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, join } from "../deno_ral/path.ts";
import { ensureDirSync } from "fs/mod.ts";
import { normalizePath } from "../core/path.ts";

export const kQuartoScratch = ".quarto";

export function projectScratchPath(dir: string, path = "") {
  const scratchDir = join(dir, kQuartoScratch);
  ensureDirSync(scratchDir);
  if (path) {
    path = join(scratchDir, path);
    ensureDirSync(dirname(path));
    return path;
  } else {
    return normalizePath(scratchDir);
  }
}
