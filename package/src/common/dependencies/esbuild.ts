/*
 * esbuild.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";

import { unTar } from "../../util/tar.ts";
import { Dependency } from "./dependencies.ts";
import { which } from "../../../../src/core/path.ts";
import { Configuration } from "../config.ts";

export function esBuild(version: string): Dependency {
  // Handle the configuration for this dependency
  const esBuildRelease = (
    platformstr: string,
  ) => {
    return {
      filename: `esbuild-${platformstr}.tgz`,
      url:
        `https://registry.npmjs.org/@esbuild/${platformstr}/-/${platformstr}-${version}.tgz`,
      configure: async (config: Configuration, path: string) => {
        const file = config.os === "windows" ? "esbuild.exe" : "esbuild";
        const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
        if (vendor === undefined || vendor === "true") {
          // Remove existing dir
          const dir = dirname(path);

          const targetDir = join(dir, config.arch);
          ensureDirSync(targetDir);

          // extracts to package/bin
          const esbuildDir = join(dir, `package`);
          if (existsSync(esbuildDir)) {
            Deno.removeSync(esbuildDir, { recursive: true });
          }

          // Expand
          await unTar(path);

          try {
            // Move the file and cleanup
            const intialPath = config.os === "windows"
              ? join(esbuildDir, file)
              : join(esbuildDir, "bin", file);

            Deno.renameSync(
              intialPath,
              join(targetDir, file),
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
        "windows": esBuildRelease("win32-x64"),
        "linux": esBuildRelease("linux-x64"),
        "darwin": esBuildRelease("darwin-x64"),
      },
      "aarch64": {
        "linux": esBuildRelease("linux-arm64"),
        "darwin": esBuildRelease("darwin-arm64"),
      },
    },
  };
}
