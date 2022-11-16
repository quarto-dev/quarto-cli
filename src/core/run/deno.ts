/*
* deno.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { extname, join } from "path/mod.ts";
import { quartoCacheDir } from "../appdirs.ts";
import { execProcess } from "../process.ts";
import { resourcePath, toolsPath } from "../resources.ts";
import { RunHandler, RunHandlerOptions } from "./types.ts";
import { removeIfExists } from "../path.ts";
import { copyTo } from "../copy.ts";

export const denoRunHandler: RunHandler = {
  canHandle: (script: string) => {
    return [".js", ".ts"].includes(extname(script).toLowerCase());
  },
  run: async (
    script: string,
    args: string[],
    stdin?: string,
    options?: RunHandlerOptions,
  ) => {
    // add deno std library (one time initialize cache on demand)
    const denoDir = initDenoCache();
    options = {
      ...options,
      env: {
        ...options?.env,
        DENO_DIR: denoDir,
      },
    };
    const importMap = resourcePath(join("deno_std", "import_map.json"));

    return await execProcess(
      {
        cmd: [
          toolsPath("deno"),
          "run",
          "--import-map",
          importMap,
          "--cached-only",
          "--allow-all",
          "--unstable",
          script,
          ...args,
        ],
        ...options,
      },
      stdin,
      undefined,
      undefined,
      true,
    );
  },
};

function initDenoCache() {
  // see if we need to create the cache
  const distDenoStd = resourcePath("deno_std");
  const distLock = join(distDenoStd, "deno_std.lock");
  const cacheDenoStd = quartoCacheDir("deno_std");
  const cacheLock = join(cacheDenoStd, "deno_std.lock");
  if (
    !existsSync(cacheLock) ||
    Deno.readTextFileSync(cacheLock) != Deno.readTextFileSync(distLock)
  ) {
    removeIfExists(cacheDenoStd);
    copyTo(distDenoStd, cacheDenoStd);
  }

  return join(cacheDenoStd, "cache");
}
