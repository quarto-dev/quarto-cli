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
import { which } from "../../../../src/core/path.ts";

export function esBuild(version: string): Dependency {
  // Handle the configuration for this dependency
  const esBuildRelease = (
    platformstr: string,
  ) => {
    return {
      filename: `esbuild-${platformstr}.tgz`,
      url:
        `https://registry.npmjs.org/esbuild-${platformstr}/-/esbuild-${platformstr}-${version}.tgz`,
      configure: async (path: string) => {

        const file = Deno.build.os === "windows" ? "esbuild.exe" : "esbuild";
        const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
        if (vendor === undefined || vendor === "true") {

          // Remove existing dir
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
            const intialPath = Deno.build.os === "windows"
              ? join(esbuildDir, file)
              : join(esbuildDir, "bin", file);
            Deno.renameSync(
              intialPath,
              join(dir, file),
            );
          } finally {
            if (existsSync(esbuildDir)) {
              Deno.removeSync(esbuildDir, { recursive: true });
            }
          }
        } else {
          // verify that the binary is on PATH, but otherwise don't do anything
          if (which(file) === undefined) {
            throw new Error(
              `${file} is not on PATH. Please install it and add it to PATH.`,
            );
          }
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
        "windows": esBuildRelease("windows-64"),
        "linux": esBuildRelease("linux-64"),
        "darwin": esBuildRelease("darwin-64"),
      },
    },
  };
}
