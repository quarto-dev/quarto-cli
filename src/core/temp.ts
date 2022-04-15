/*
* temp.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { warning } from "log/mod.ts";
import { join } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";
import { removeIfExists } from "./path.ts";

export type { TempContext } from "./temp-types.ts";

let tempDir: string | undefined;

export function initSessionTempDir() {
  tempDir = Deno.makeTempDirSync({ prefix: "quarto-session" });
}

export function cleanupSessionTempDir() {
  if (tempDir) {
    removeIfExists(tempDir);
    tempDir = undefined;
  }
}

export function createTempContext(options?: Deno.MakeTempOptions) {
  let dir: string | undefined = Deno.makeTempDirSync({
    ...options,
    dir: tempDir,
  });
  return {
    createFile: (options?: Deno.MakeTempOptions) => {
      return Deno.makeTempFileSync({ ...options, dir });
    },
    createDir: (options?: Deno.MakeTempOptions) => {
      return Deno.makeTempDirSync({ ...options, dir });
    },
    cleanup: () => {
      if (dir) {
        try {
          removeIfExists(dir);
        } catch (error) {
          warning(`Error removing temp dir at ${dir}: ${error.message}`);
        }
        dir = undefined;
      }
    },
  };
}

export function systemTempDir(name: string) {
  const dir = join(rootTempDir(), name);
  ensureDirSync(dir);
  return dir;
}

function rootTempDir() {
  const tempDir = Deno.build.os === "windows"
    ? Deno.env.get("TMP") || Deno.env.get("TEMP") ||
      Deno.env.get("USERPROFILE") || ""
    : Deno.env.get("TMPDIR") || "/tmp";
  return Deno.realPathSync(tempDir);
}
