/*
* esbuild.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { Dependency } from "./dependencies.ts";
import { Configuration } from "../config.ts";
import { join } from "path/mod.ts";
import { dirname } from "../../../../src/vendor/deno.land/std@0.166.0/path/win32.ts";
import { unzip } from "../../util/utils.ts";

export function deno(version: string): Dependency {
  // Handle the configuration for this dependency
  const officialDenoRelease = (
    platformstr: string,
    denoDir: string,
  ) => {
    // https://github.com/denoland/deno/releases/download/v1.30.2/deno-aarch64-apple-darwin.zip
    return {
      filename: `deno-${platformstr}.zip`,
      url: `https://github.com/denoland/deno/releases/download/${version}/`,
      configure: async (_config: Configuration, path: string) => {
        const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
        if (vendor === undefined || vendor === "true") {
          const dest = join(dirname(path), denoDir);

          // Expand
          await unzip(path, dest);
        }
      },
    };
  };

  return {
    name: "Deno typescript runtime",
    bucket: "deno",
    version,
    architectureDependencies: {
      "x86_64": {
        "windows": officialDenoRelease("x86_64-pc-windows-msvc", ""),
        "linux": officialDenoRelease(
          "x86_64-unknown-linux-gnu",
          "deno-x86_64-unknown-linux-gnu",
        ),
        "darwin": officialDenoRelease(
          "x86_64-apple-darwin",
          "deno-x86_64-apple-darwin",
        ),
      },
      "aarch64": {
        "darwin": officialDenoRelease(
          "aarch64-apple-darwin",
          "deno-aarch64-apple-darwin",
        ),
      },
    },
  };
}
