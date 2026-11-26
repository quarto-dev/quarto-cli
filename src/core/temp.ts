/*
 * temp.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { debug, info } from "../deno_ral/log.ts";
import { join } from "../deno_ral/path.ts";
import {
  ensureDirSync,
  existsSync,
  writeTextFileSync,
} from "../deno_ral/fs.ts";
import { normalizePath, removeIfExists, safeRemoveIfExists } from "./path.ts";
import { TempContext } from "./temp-types.ts";
import { isWindows } from "../deno_ral/platform.ts";
import {
  makeTempDirSync,
  makeTempFileSync,
  type TempOptions,
} from "../deno_ral/temp.ts";
import { env } from "../deno_ral/env.ts";

export type { TempContext } from "./temp-types.ts";

let tempDir: string | undefined;

let tempContext: TempContext | undefined;

export function initSessionTempDir() {
  // if TMPDIR exists and has been removed (sometimes occurs for stale TMPDIR values
  // in resurrected RStudio terminal sessions) then try to re-create it
  const tmpEnv = env.get("TMPDIR");
  if (tmpEnv) {
    try {
      if (!existsSync(tmpEnv)) {
        ensureDirSync(tmpEnv);
      }
    } catch (err) {
      if (!(err instanceof Error)) throw err;
      if (err.message) {
        debug("Error attempting to create TMPDIR: " + err.message);
      }
    }
  }

  tempDir = makeTempDirSync({ prefix: "quarto-session" });
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

export function createTempContext(options?: TempOptions): TempContext {
  if (options?.dir) {
    ensureDirSync(options?.dir);
  }
  let dir: string | undefined = makeTempDirSync({
    dir: tempDir,
    ...options,
  });

  const tempContextCleanupHandlers: VoidFunction[] = [];

  const result: TempContext = {
    baseDir: dir,
    createFileFromString: (content: string, options?: TempOptions) => {
      const file = result.createFile(options);
      writeTextFileSync(file, content);
      return file;
    },
    createFile: (options?: TempOptions) => {
      return makeTempFileSync({ ...options, dir });
    },
    createDir: (options?: TempOptions) => {
      return makeTempDirSync({ ...options, dir });
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
  return result;
}

export function systemTempDir(name: string) {
  const dir = join(rootTempDir(), name);
  ensureDirSync(dir);
  return dir;
}

function rootTempDir() {
  const tempDir = isWindows
    ? env.get("TMP") || env.get("TEMP") ||
      env.get("USERPROFILE") || ""
    : env.get("TMPDIR") || "/tmp";
  return normalizePath(tempDir);
}
