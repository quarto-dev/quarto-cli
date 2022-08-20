/*
* dartsass.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";

import { unTar } from "../../util/tar.ts";
import { Dependency } from "./dependencies.ts";

export function dartSass(version: string): Dependency {
  // Maps the file name and pandoc executable file name to a repo and expand
  // to create a pandocRelease
  const dartRelease = (
    filename: string,
  ) => {
    return {
      filename,
      url:
        `https://github.com/sass/dart-sass/releases/download/${version}/${filename}`,
      configure: async (path: string) => {
        // Remove existing dart-sass dir
        const dir = dirname(path);
        const dartSubdir = join(dir, `dart-sass`);
        if (existsSync(dartSubdir)) {
          Deno.removeSync(dartSubdir, { recursive: true });
        }

        // Expand
        await unTar(path);
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
    },
  };
}
