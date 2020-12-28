/*
* config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";

import { Logger, logger } from "../util/logger.ts";
import { getEnv } from "../util/utils.ts";

// The core configuration for the packaging process
export interface Configuration {
  productname: string;
  importmap: string;
  dirs: {
    root: string;
    src: string;
    pkg: string;
    dist: string;
    share: string;
    bin: string;
    out: string;
  };
  version: string;
  log: Logger;
  pkgConfig: PkgConfig;
}

// Packaging specific configuration
// (Some things are global others may be platform specific)
export interface PkgConfig {
  name: string;
  identifier: string;
  packageArgs: () => string[];
}

// Get the current configuration
export function configuration(logLevel: number): Configuration {

  const productname = "quarto";

  const execPath = Deno.execPath();
  const root = join(execPath, "..", "..", "..", "..");

  const pkg = join(root, getEnv("QUARTO_PACKAGE_DIR"));
  const dist = join(pkg, getEnv("QUARTO_DIST_DIR"));
  const share = join(dist, getEnv("QUARTO_SHARE_DIR"));
  const src = join(root, "src");
  const out = join(pkg, "out");
  const bin = join(dist, "bin");

  const version = "0.1";

  const importmap = join(src, "import_map.json");

  const pkgConfig = {
    identifier: "org.rstudio.quarto",
    name: `quarto-${version}-macos.pkg`,
    packageArgs: () => {
      const scriptDir = join(pkg, "scripts", "macos", "pkg");
      return [
        "--scripts",
        scriptDir,
        "--install-location",
        '"/Library/Quarto"',
      ];
    },
  };

  return {
    productname,
    importmap,
    dirs: {
      root,
      src,
      pkg,
      dist,
      share,
      bin,
      out,
    },
    version,
    log: logger(logLevel),
    pkgConfig,
  };
}
