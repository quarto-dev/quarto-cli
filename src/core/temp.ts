/*
 * temp.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { debug, info } from "../deno_ral/log.ts";
import { join } from "../deno_ral/path.ts";
import { ensureDirSync, existsSync } from "../deno_ral/fs.ts";
import { normalizePath, removeIfExists, safeRemoveIfExists } from "./path.ts";
import { TempContext } from "./temp-types.ts";
import { isWindows } from "../deno_ral/platform.ts";

export type { TempContext } from "./temp-types.ts";

let tempDir: string | undefined;

let tempContext: TempContext | undefined;

export function initSessionTempDir() {
  // if TMPDIR exists and has been removed (sometimes occurs for stale TMPDIR values
  // in resurrected RStudio terminal sessions) then try to re-create it
  const tmpEnv = Deno.env.get("TMPDIR");
  if (tmpEnv) {
    try {
      if (!existsSync(tmpEnv)) {
        ensureDirSync(tmpEnv);
      }
    } catch (err) {
      if (err.message) {
        debug("Error attempting to create TMPDIR: " + err.message);
      }
    }
  }

  tempDir = Deno.makeTempDirSync({ prefix: "quarto-session" });
}

export function cleanupSessionTempDir() {
  if (tempContext) {
    tempContext.cleanup();
    tempContext = undefined;
  }
  if (tempDir) {
    removeIfExists(tempDir);
    tempDir = undefined;
  }
}

export function globalTempContext() {
  if (tempContext === undefined) {
    tempContext = createTempContext();
  }
  return tempContext;
}

export function createTempContext(options?: Deno.MakeTempOptions): TempContext {
  let dir: string | undefined = Deno.makeTempDirSync({
    ...options,
    dir: tempDir,
  });

  const tempContextCleanupHandlers: VoidFunction[] = [];

  return {
    baseDir: dir,
    createFile: (options?: Deno.MakeTempOptions) => {
      return Deno.makeTempFileSync({ ...options, dir });
    },
    createDir: (options?: Deno.MakeTempOptions) => {
      return Deno.makeTempDirSync({ ...options, dir });
    },
    cleanup: () => {
      if (dir) {
        // Not using .reverse() to not mutate the original array
        for (let i = tempContextCleanupHandlers.length - 1; i >= 0; i--) {
          const handler = tempContextCleanupHandlers[i];
          try {
            handler();
          } catch (error) {
            info("Error occurred during tempContext handler cleanup: " + error);
          }
        }
        safeRemoveIfExists(dir);
        dir = undefined;
      }
    },
    onCleanup(handler: VoidFunction) {
      tempContextCleanupHandlers.push(handler);
    },
  };
}

export function systemTempDir(name: string) {
  const dir = join(rootTempDir(), name);
  ensureDirSync(dir);
  return dir;
}

function rootTempDir() {
  const tempDir = isWindows
    ? Deno.env.get("TMP") || Deno.env.get("TEMP") ||
      Deno.env.get("USERPROFILE") || ""
    : Deno.env.get("TMPDIR") || "/tmp";
  return normalizePath(tempDir);
}
