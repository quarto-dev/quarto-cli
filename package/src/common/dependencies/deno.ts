/*
* esbuild.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { Dependency } from "./dependencies.ts";
import { Configuration } from "../config.ts";
import { join, dirname } from "../../../../src/deno_ral/path.ts";
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

  // Handle the configuration for this dependency
  const linuxAmd64DenoRelease = () => {
    // Before 1.41 available at: 
    // https://github.com/LukeChannings/deno-arm64/releases/download/v1.28.2/deno-linux-arm64.zip
    // but after 1.41 available at:
    // https://github.com/denoland/deno/releases/download/v1.41.0/deno-aarch64-unknown-linux-gnu.zip
    return {
      filename: `deno-aarch64-unknown-linux-gnu.zip`,
      url:
        `https://github.com/denoland/deno/releases/download/${version}/`,
      configure: async (_config: Configuration, path: string) => {
        const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
        if (vendor === undefined || vendor === "true") {
          const dest = join(dirname(path), "aarch64");

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
        "windows": officialDenoRelease("x86_64-pc-windows-msvc", "x86_64"),
        "linux": officialDenoRelease(
          "x86_64-unknown-linux-gnu",
          "x86_64",
        ),
        "darwin": officialDenoRelease(
          "x86_64-apple-darwin",
          "x86_64",
        ),
      },
      "aarch64": {
        "darwin": officialDenoRelease(
          "aarch64-apple-darwin",
          "aarch64",
        ),
        "linux": linuxAmd64DenoRelease(),
      },
    },
  };
}
