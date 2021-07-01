/*
* esbuild.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";

import { unTar } from "../../util/tar.ts";
import { Dependency } from "./dependencies.ts";

export function esBuild(version: string): Dependency {
  // Maps the file name and pandoc executable file name to a repo and expand
  // to create a pandocRelease
  const esBuildRelease = (
    platformstr: string,
  ) => {
    return {
      filename: `esbuild-${platformstr}`,
      url:
        `https://registry.npmjs.org/esbuild-${platformstr}/-/esbuild-${platformstr}-${version}.tgz`,
      configure: async (path: string) => {
        // Remove existing dart-sass dir
        const dir = dirname(path);

        // extracts to package/bin
        const esbuildDir = join(dir, `package`);
        if (existsSync(esbuildDir)) {
          Deno.removeSync(esbuildDir, { recursive: true });
        }

        // Expand
        await unTar(path);

        try {
          // Move the file and cleanup
          const file = "esbuild";
          Deno.renameSync(
            join(esbuildDir, "bin", file),
            join(dir, file),
          );
        } finally {
          if (existsSync(esbuildDir)) {
            Deno.removeSync(esbuildDir, { recursive: true });
          }
        }
      },
    };
  };

  return {
    name: "esbuild javscript bundler",
    version,
    "windows": esBuildRelease("windows-64"),
    "linux": esBuildRelease("linux-64"),
    "darwin": esBuildRelease("darwin-64"),
  };
}
