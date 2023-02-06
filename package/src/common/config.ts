/*
* config.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
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
  os: "windows" | "linux" | "darwin";
  arch: "x86_64" | "aarch64";
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
  pkgWorking: string;
}

export const kValidOS = ["windows", "linux", "darwin"];
export const kValidArch = ["x86_64", "aarch64"];

// Read the configuration fromt the environment
export function readConfiguration(
  version?: string,
  os?: "windows" | "linux" | "darwin",
  arch?: "x86_64" | "aarch64",
): Configuration {
  const productName = getEnv("QUARTO_NAME");
  version = version || getEnv("QUARTO_VERSION");

  const root = getEnv("QUARTO_ROOT");
  const src = getEnv("QUARTO_SRC_PATH");

  const pkg = getEnv("QUARTO_PACKAGE_PATH") || "package";
  const out = join(pkg, getEnv("QUARTO_OUT_DIR") || "out");

  const dist = getEnv("QUARTO_DIST_PATH") || "dist";
  const share = getEnv("QUARTO_SHARE_PATH") ||
    join(dist, getEnv("QUARTO_SHARE_DIR") || "share");
  const bin = getEnv("QUARTO_BIN_PATH") ||
    join(dist, getEnv("QUARTO_BIN_DIR") || "bin");
  const pkgWorking = join(pkg, "pkg-working");

  const directoryInfo = {
    root,
    pkg,
    dist,
    share,
    src,
    out,
    bin,
    pkgWorking,
  };

  const cmdOs = os || getEnv("QUARTO_OS", Deno.build.os);
  if (!kValidOS.includes(cmdOs)) {
    throw new Error(
      `Invalid OS ${os} provided. Please use one of ${kValidOS.join(",")}`,
    );
  }
  const cmdArch = arch || getEnv("QUARTO_OS", Deno.build.arch);
  if (!kValidArch.includes(cmdArch)) {
    throw new Error(
      `Invalid arch ${arch} provided. Please use one of ${
        kValidArch.join(",")
      }`,
    );
  }

  const importmap = join(src, "dev_import_map.json");

  return {
    productName,
    version,
    importmap,
    directoryInfo,
    os: cmdOs as "windows" | "linux" | "darwin",
    arch: cmdArch as "x86_64" | "aarch64",
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
