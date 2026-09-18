/*
* config.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { join } from "../../../src/deno_ral/path.ts";
import { info } from "../../../src/deno_ral/log.ts";

import { getEnv } from "../util/utils.ts";

import { os as platformOs } from "../../../src/deno_ral/platform.ts"
import * as Pandoc from "../../../src/core/pandoc/json.ts";
import { fromObjects } from "../../../src/core/pandoc/table.ts";

// The core configuration for the packaging process
export interface Configuration extends PlatformConfiguration {
  productName: string;
  version: string;
  importmap: string;
  directoryInfo: DirectoryInfo;
}

export interface PlatformConfiguration {
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
  tools: string;
  pkgWorking: {
    root: string;
    bin: string;
    share: string;
  };
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
  const shareName = getEnv("QUARTO_SHARE_DIR") || "share";
  const share = getEnv("QUARTO_SHARE_PATH") ||
    join(dist, shareName);
  const binName = getEnv("QUARTO_BIN_DIR") || "bin";
  const bin = getEnv("QUARTO_BIN_PATH") ||
    join(dist, binName);
  const pkgWorkingBase = join(pkg, "pkg-working");
  const toolsName = getEnv("QUARTO_TOOLS_NAME", "tools");
  const tools = getEnv("QUARTO_TOOLS_PATH", join(root, toolsName));

  const directoryInfo = {
    root,
    pkg,
    dist,
    share,
    src,
    out,
    bin,
    tools,
    pkgWorking: {
      root: pkgWorkingBase,
      bin: join(pkgWorkingBase, binName),
      share: join(pkgWorkingBase, shareName),
    },
  };



  const cmdOs = os || getEnv("QUARTO_OS", platformOs);
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

  const importmap = join(src, "import_map.json");

  return {
    productName,
    version,
    importmap,
    directoryInfo,
    os: cmdOs as "windows" | "linux" | "darwin",
    arch: cmdArch as "x86_64" | "aarch64",
  };
}

export function configurationAST(config: Configuration): Pandoc.Block[] {
  const makeObject = (
    obj: {
      key: string,
      value: string
  },
  ) => ({
    "key": [Pandoc.plain([Pandoc.str(obj.key)])], 
    "value": [Pandoc.plain([Pandoc.code(obj.value)])]
  });
  const configTable = fromObjects([
    {key: "OS", value: config.os},
    {key: "Arch", value: config.arch},
    {key: "Version", value: config.version},
    {key: "Cwd", value: Deno.cwd()},
    {key: "Package folder (build source)", value: config.directoryInfo.pkg},
    {key: "Dist folder (output folder)", value: config.directoryInfo.dist},
    {key: "Bin folder", value: config.directoryInfo.bin},
    {key: "Share folder", value: config.directoryInfo.share},
    {key: "Package working folder", value: config.directoryInfo.pkgWorking.root},
  ].map(makeObject), undefined, [
    Pandoc.colspec("AlignLeft", {t: "ColWidth", c: 0.3}),
    Pandoc.colspec("AlignLeft", {t: "ColWidth", c: 0.6}),
  ]);
  return [
    Pandoc.header(2, [Pandoc.str("Configuration:")]),
    configTable,
  ];
}

export function printConfiguration(config: Configuration) {
  info("");
  info("******************************************");
  info("Configuration:");
  info(` - OS:       ${config.os}`);
  info(` - Arch:     ${config.arch}`);
  info(` - Version:  ${config.version}`);
  info(` - Cwd:      ${Deno.cwd()}`);
  info(` - DENO_DIR: ${Deno.env.get("DENO_DIR")}`);
  info(` - Directory configuration:`);
  info(
    `   - Package folder (build source): ${config.directoryInfo.pkg}`,
  );
  info(`   - Dist folder (output folder): ${config.directoryInfo.dist}`);
  info(`     - bin folder: ${config.directoryInfo.bin}`);
  info(`     - share folder: ${config.directoryInfo.share}`);
  info(`   - Package working folder: ${config.directoryInfo.pkgWorking.root}`);
  
  info("");
  info("******************************************");
  info("");

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
