/*
* pandoc.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { existsSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";

import { unTar } from "../../util/tar.ts";
import { unzip } from "../../util/utils.ts";
import { Dependency } from "./dependencies.ts";
import { which } from "../../../../src/core/path.ts";
import { Configuration } from "../config.ts";

export function pandoc(version: string): Dependency {
  // Maps the file name and pandoc executable file name to a repo and expand
  // to create a pandocRelease
  const pandocRelease = (
    filename: string,
    pandocBinary: string,
  ) => {
    return {
      filename,
      url:
        `https://github.com/jgm/pandoc/releases/download/${version}/${filename}`,
      configure: async (config: Configuration, path: string) => {
        const dir = join(dirname(path), config.arch);
        // TODO: deal with aarch64 pandoc
        const pandocSubdir = join(dir, `pandoc-${version}${(config.os === "darwin" ) ? ("-" + "x86_64") : ""}`);
        const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
        if (vendor === undefined || vendor === "true") {
          // Clean pandoc interim dir
          if (existsSync(pandocSubdir)) {
            Deno.removeSync(pandocSubdir, { recursive: true });
          }

          // Extract pandoc
          if (config.os !== "windows") {
            await unTar(path);

            // move the binary
            Deno.renameSync(
              join(pandocSubdir, "bin", pandocBinary),
              join(dir, pandocBinary),
            );
          } else {
            await unzip(path, dir);

            // move the binary
            Deno.renameSync(
              join(pandocSubdir, pandocBinary),
              join(dir, pandocBinary),
            );
          }

          // cleanup
          if (existsSync(pandocSubdir)) {
            Deno.removeSync(pandocSubdir, { recursive: true });
          }
        } else {
          // verify that the binary is on PATH, but otherwise don't do anything
          if (which(pandocBinary) === undefined) {
            throw new Error(
              `${pandocBinary} is not on PATH. Please install it and add it to PATH.`,
            );
          }
        }
      },
    };
  };

  // The pandocRelease
  return {
    name: "Pandoc",
    bucket: "pandoc",
    version,
    architectureDependencies: {
      "x86_64": {
        "windows": pandocRelease(
          `pandoc-${version}-windows-x86_64.zip`,
          "pandoc.exe",
        ),
        "linux": pandocRelease(
          `pandoc-${version}-linux-amd64.tar.gz`,
          "pandoc",
        ),
        "darwin": pandocRelease(
          `pandoc-${version}-x86_64-macOS.zip`,
          "pandoc",
        ),
      },
      "aarch64": {
        "linux": pandocRelease(
          `pandoc-${version}-linux-arm64.tar.gz`,
          "pandoc",
        ),
        "darwin" : pandocRelease(
          `pandoc-${version}-arm64-macOS.zip`,
          "pandoc",
        )
      },
    },
  };
}
