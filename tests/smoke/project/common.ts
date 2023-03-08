/*
* common.ts
*
* Copyright (C) 2020-2023 Posit, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";

export const kProjectWorkingDir = "simple-test";
export const kQuartoProjectFile = join(kProjectWorkingDir, "_quarto.yml");

export async function cleanWorking() {
  if (existsSync(kProjectWorkingDir)) {
    await Deno.remove(kProjectWorkingDir, { recursive: true });
  }
}
