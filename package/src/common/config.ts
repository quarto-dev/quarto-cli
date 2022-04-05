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

  const execPath = Deno.execPath();
  const root = join(execPath, "..", "..", "..", "..", "..");
  const pkg = join(root, getEnv("QUARTO_PACKAGE_DIR"));
  const dist = join(pkg, getEnv("QUARTO_DIST_DIR"));
  const share = join(dist, getEnv("QUARTO_SHARE_DIR"));
  const src = join(root, getEnv("QUARTO_SRC_DIR"));
  const out = join(pkg, getEnv("QUARTO_OUT_DIR"));
  const bin = join(dist, getEnv("QUARTO_BIN_DIR"));
  const directoryInfo = {
    root,
    pkg,
    dist,
    share,
    src,
    out,
    bin,
  };

  const importmap = join(src, "import_map.json");

  return {
    productName,
    version,
    importmap,
    directoryInfo,
  };
}
