import { getEnv } from "./utils.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { kInfo } from "./logger.ts";

// The core configuration for the packaging process
export interface Configuration {
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
  logLevel: 0 | 1 | 2;
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
export function configuration(): Configuration {
  const execPath = Deno.execPath();
  const root = join(execPath, "..", "..", "..", "..");

  const pkg = join(root, getEnv("QUARTO_PACKAGE_DIR"));
  const dist = join(pkg, getEnv("QUARTO_DIST_DIR"));
  const share = join(dist, getEnv("QUARTO_SHARE_DIR"));
  const src = join(root, "src");
  const out = join(dist, "out");
  const bin = join(dist, "bin");

  const version = "0.1";

  const importmap = join(src, "import_map.json");

  const pkgConfig = {
    identifier: "org.rstudio.quarto",
    name: `quarto-${version}.pkg`,
    packageArgs: () => {
      const scriptDir = join(pkg, "scripts", "macod", "pkg");
      return [
        `--scripts ${scriptDir}`,
        `--install-location \"/Library/Quarto\"`,
      ];
    },
  };

  return {
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
    logLevel: kInfo,
    pkgConfig,
  };
}
