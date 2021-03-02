/*
* temp.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";
import { removeIfExists } from "./path.ts";

let tempDir: string | undefined;

export function initSessionTempDir() {
  tempDir = Deno.makeTempDirSync({ prefix: "quarto-session" });
}

export function sessionTempFile(options?: Deno.MakeTempOptions) {
  return Deno.makeTempFileSync({ ...options, dir: tempDir });
}

export function sessionTempDir() {
  return tempDir!;
}

export function createSessionTempDir(options?: Deno.MakeTempOptions) {
  return Deno.makeTempDirSync({ ...options, dir: tempDir });
}

export function cleanupSessionTempDir() {
  if (tempDir) {
    removeIfExists(tempDir);
    tempDir = undefined;
  }
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
