/*
 * project-scratch.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, join } from "../deno_ral/path.ts";
import { ensureDirSync, existsSync } from "../deno_ral/fs.ts";
import { normalizePath } from "../core/path.ts";
import { warning } from "../deno_ral/log.ts";

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

// Migrate a scratch path from an old location to a new location.
// If the old path exists and the new path doesn't, moves the old to new.
// Returns the new path (via projectScratchPath which ensures it exists).
export function migrateProjectScratchPath(
  dir: string,
  oldSubpath: string,
  newSubpath: string,
): string {
  const scratchDir = join(dir, kQuartoScratch);
  const oldPath = join(scratchDir, oldSubpath);
  const newPath = join(scratchDir, newSubpath);

  if (existsSync(oldPath) && !existsSync(newPath)) {
    // Ensure parent directory of new path exists
    ensureDirSync(dirname(newPath));
    try {
      Deno.renameSync(oldPath, newPath);
    } catch (e) {
      // Migration failed - not fatal, cache will be rebuilt
      warning(`Failed to migrate ${oldSubpath} to ${newSubpath}: ${e}`);
    }
  }

  return projectScratchPath(dir, newSubpath);
}
