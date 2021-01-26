/*
* path.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, extname } from "path/mod.ts";

import { existsSync } from "fs/exists.ts";
import { getenv } from "./env.ts";
import { execProcess } from "./process.ts";

export function removeIfExists(file: string) {
  if (existsSync(file)) {
    Deno.removeSync(file, { recursive: true });
  }
}

export function dirAndStem(file: string) {
  return [
    dirname(file),
    basename(file, extname(file)),
  ];
}

export function expandPath(path: string) {
  return path.replace(/^~\//, getenv("HOME", "~") + "/");
}

export async function which(cmd: string) {
  const args = Deno.build.os === "windows"
    ? ["CMD", "/C", "where", cmd]
    : ["which", cmd];
  const result = await execProcess(
    { cmd: args, stderr: "piped", stdout: "piped" },
  );
  if (result.code === 0) {
    return result.stdout?.trim();
  } else {
    return undefined;
  }
}
