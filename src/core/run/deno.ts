/*
 * deno.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync, expandGlobSync } from "fs/mod.ts";
import { extname, join, normalize } from "path/mod.ts";
import { quartoCacheDir } from "../appdirs.ts";
import { execProcess } from "../process.ts";
import { architectureToolsPath, resourcePath } from "../resources.ts";
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

    const importMap = normalize(join(denoDir, "../run_import_map.json"));

    return await execProcess(
      {
        cmd: [
          architectureToolsPath("deno"),
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

function directoryListing(path: string): Set<string> {
  return new Set(
    [...expandGlobSync(path + "/**")].map((x) => x.path.slice(path.length)),
  );
}

function directoryListingsMatch(path1: string, path2: string): boolean {
  const listing1 = directoryListing(path1),
    listing2 = directoryListing(path2);
  for (const path of listing1) {
    if (!listing2.has(path)) {
      return false;
    }
  }
  return true;
}

function initDenoCache() {
  // see if we need to create the cache
  const distDenoStd = resourcePath("deno_std");
  const cacheDenoStd = quartoCacheDir("deno_std");

  const filesDiffer = (file: string) => {
    const file1 = join(distDenoStd, file);
    const file2 = join(cacheDenoStd, file);
    if (!existsSync(file2)) {
      return true;
    }
    return Deno.readTextFileSync(file1) !== Deno.readTextFileSync(file2);
  };
  const fileList = ["deno_std.lock", "import_map.json", "run_import_map.json"];
  if (
    fileList.some(filesDiffer) ||
    // perf: don't check contents; instead only look at filenames, since they're all hashed anyway
    !directoryListingsMatch(distDenoStd, cacheDenoStd)
  ) {
    removeIfExists(cacheDenoStd);
    copyTo(distDenoStd, cacheDenoStd);
  }

  return join(cacheDenoStd, "cache");
}
