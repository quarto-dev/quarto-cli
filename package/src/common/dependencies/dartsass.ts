/*
* dartsass.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { dirname, join } from "../../../../src/deno_ral/path.ts";

import { unTar } from "../../util/tar.ts";
import { Configuration } from "../config.ts";
import { Dependency } from "./dependencies.ts";

export function dartSass(version: string): Dependency {
  const dartRelease = (
    filename: string,
  ) => {
    return {
      filename,
      url:
        `https://github.com/sass/dart-sass/releases/download/${version}/${filename}`,
      configure: async (config: Configuration, path: string) => {
        const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
        if (vendor === undefined || vendor === "true") {
          // Remove existing dart-sass dir
          const dir = dirname(path);
          const targetDir = join(dir, config.arch);
          ensureDirSync(targetDir);

          const dartSubdir = join(targetDir, `dart-sass`);
          if (existsSync(dartSubdir)) {
            Deno.removeSync(dartSubdir, { recursive: true });
          }
          
          // Expand
          await unTar(path, targetDir);
        }
      },
    };
  };

  return {
    name: "Dart Sass Compiler",
    bucket: "dart-sass",
    version,
    architectureDependencies: {
      "x86_64": {
        "windows": dartRelease(`dart-sass-${version}-windows-x64.zip`),
        "linux": dartRelease(`dart-sass-${version}-linux-x64.tar.gz`),
        "darwin": dartRelease(`dart-sass-${version}-macos-x64.tar.gz`),
      },
      "aarch64": {
        "linux": dartRelease(`dart-sass-${version}-linux-arm64.tar.gz`),
        "darwin": dartRelease(`dart-sass-${version}-macos-arm64.tar.gz`),
      },
    },
  };
}
