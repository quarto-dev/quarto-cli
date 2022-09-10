/*
* project-dotenv.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { config } from "dotenv/mod.ts";
import { join } from "path/mod.ts";
import { safeExistsSync } from "../core/path.ts";

export async function initializeDotenv(projectDir: string) {
  // define config file locations
  const configs = {
    defaults: join(projectDir, "_quarto.env"),
    example: join(projectDir, "_quarto.example.env"),
    path: join(projectDir, "_quarto.local.env"),
  };
  // read config ('safe' means enforce example entries)
  const conf = await config({
    ...configs,
    safe: true,
  });
  // set environment variables
  for (const key in conf) {
    Deno.env.set(key, conf[key]);
  }
  // return files that actually contributed to the config
  return Object.values(configs).filter(safeExistsSync);
}
