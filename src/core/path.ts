/*
* path.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, extname } from "path/mod.ts";

import { existsSync } from "fs/exists.ts";
import { getenv } from "./env.ts";

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
