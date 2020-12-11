import { getEnv } from "./utils.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { kInfo } from "./logger.ts";

export interface Configuration {
  importmap: string;
  dirs: {
    root: Directory;
    src: Directory;
    pkg: Directory;
    dist: Directory;
    share: Directory;
    bin: Directory;
    out: Directory;
  };
  version: string;
  logLevel: 0 | 1 | 2;
  pkgInfo: PkgInfo;
}

export interface PkgInfo {
  name: string;
  identifier: string;
  packageArgs: () => string[];
}

export interface Directory {
  rel: string;
  abs: string;
}

export function configuration(): Configuration {
  const execPath = Deno.execPath();
  const rootPath = join(execPath, "..", "..", "..", "..");

  const directory = (...relPaths: string[]): Directory => {
    return {
      rel: join(...relPaths),
      abs: join(rootPath, ...relPaths),
    };
  };

  const root = directory("");
  const pkg = directory(root.rel, getEnv("QUARTO_PACKAGE_DIR"));
  const dist = directory(pkg.rel, getEnv("QUARTO_DIST_DIR"));
  const share = directory(dist.rel, getEnv("QUARTO_SHARE_DIR"));
  const src = directory(root.rel, "src");
  const out = directory(dist.rel, "out");
  const bin = directory(dist.rel, "bin");

  const version = "0.1";

  const importmap = join(src.abs, "import_map.json");

  const pkgInfo = {
    identifier: "org.rstudio.quarto",
    name: `quarto-${version}.pkg`,
    packageArgs: () => {
      const scriptDir = join(pkg.abs, "scripts", "macod", "pkg");
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
    pkgInfo,
  };
}
