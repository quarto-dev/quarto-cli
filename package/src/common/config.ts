/*
* config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { getEnv } from "../util/utils.ts";

// The core configuration for the packaging process
export interface Configuration {
  productName: string;
  version: string;
  importmap: string;
  directoryInfo: DirectoryInfo;
}

// Directories avaialable for step
export interface DirectoryInfo {
  root: string;
  src: string;
  pkg: string;
  dist: string;
  share: string;
  bin: string;
  out: string;
}

// Read the configuration fromt the environment
export function readConfiguration(
  version?: string,
): Configuration {
  const productName = getEnv("QUARTO_NAME");
  version = version || getEnv("QUARTO_VERSION");

  const root = getEnv("QUARTO_ROOT");
  const src = getEnv("QUARTO_SRC_PATH");

  const pkg = getEnv("QUARTO_PACKAGE_PATH") || "package";
  const out = join(pkg, getEnv("QUARTO_OUT_DIR") || "out");

  const dist = getEnv("QUARTO_DIST_PATH") || "dist";
  const share = getEnv("QUARTO_SHARE_PATH") || join(dist, getEnv("QUARTO_SHARE_DIR") || "share");
  const bin = getEnv("QUARTO_BIN_PATH") || join(dist, getEnv("QUARTO_BIN_DIR") || "bin");
  const directoryInfo = {
    root,
    pkg,
    dist,
    share,
    src,
    out,
    bin,
  };

  const importmap = join(src, "dev_import_map.json");

  return {
    productName,
    version,
    importmap,
    directoryInfo,
  };
}

// Utility that provides a working directory and cleans it up
export async function withWorkingDir(fn: (wkDir: string) => Promise<void>) {
  const workingDir = Deno.makeTempDirSync();
  try {
    await fn(workingDir);
  } finally {
    Deno.removeSync(workingDir, { recursive: true });
  }
}
