/*
* esbuild.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join } from "path/mod.ts";

import { unTar } from "../../util/tar.ts";
import { removeDirIfExists } from "../../util/fs.ts";
import { Dependency } from "./dependencies.ts";

export function esBuild(version: string): Dependency {
  // Handle the configuration for this dependency
  const esBuildRelease = (
    platformstr: string,
    archstr: string,
  ) => {
    const arch = archstr == "aarch64" ? "arm64" : "64";
    const slug = `esbuild-${platformstr}-${arch}`;
    return {
      filename: slug,
      // https://esbuild.github.io/getting-started/#download-a-build
      url: `https://registry.npmjs.org/${slug}/-/${slug}-${version}.tgz`,
      configure: async (path: string) => {
        // Remove existing dir
        const dir = dirname(path);

        // extracts to package/bin
        const esbuildDir = join(dir, `package`);
        await removeDirIfExists(esbuildDir);
        // Expand
        await unTar(path);

        try {
          // Move the file and cleanup
          const file = Deno.build.os === "windows" ? "esbuild.exe" : "esbuild";
          const intialPath = Deno.build.os === "windows"
            ? join(esbuildDir, file)
            : join(esbuildDir, "bin", file);
          Deno.renameSync(
            intialPath,
            join(dir, file),
          );
        } finally {
          await removeDirIfExists(esbuildDir);
        }
      },
    };
  };

  return {
    name: "esbuild javscript bundler",
    bucket: "esbuild",
    version,
    architectureDependencies: {
      "x86_64": {
        "windows": esBuildRelease("windows", "x86_64"),
        "linux": esBuildRelease("linux", "x86_64"),
        "darwin": esBuildRelease("darwin", "x86_64"),
      },
      "aarch64": {
        "windows": esBuildRelease("windows", "aarch64"),
        "linux": esBuildRelease("linux", "aarch64"),
        "darwin": esBuildRelease("darwin", "aarch64"),
      },
    },
  };
}
