/*
* deno_dom.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ensureDir } from "fs/mod.ts";
import { basename, dirname, join } from "path/mod.ts";
import { Configuration } from "../config.ts";

import { Dependency } from "./dependencies.ts";

export function deno_dom(version: string): Dependency {
  const deno_dom_release = (filename: string, baseUrl="https://github.com/b-fuze/deno-dom") => {
    return {
      filename,
      url:
        `${baseUrl}/releases/download/${version}/${filename}`,
      configure: async (config: Configuration, path: string) => {
        const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
        if (vendor === undefined || vendor === "true") {
          const targetPath = join(dirname(path), config.arch, "deno_dom", basename(path));
          await ensureDir(dirname(targetPath));
          await Deno.copyFile(path, targetPath);
        } else {
          if (Deno.env.get("DENO_DOM_PLUGIN") === undefined) {
            throw new Error(
              `DENO_DOM_PLUGIN is not set, and vendoring is turned off. Please install deno-dom and set DENO_DOM_PLUGIN.`,
            );
          }
        }
      },
    };
  };

  const deno_dom_release_dragonstyle = (filename: string) => {
    return deno_dom_release(filename, "https://github.com/dragonstyle/deno-dom")
  }

  return {
    name: "deno_dom",
    bucket: "deno_dom",
    version,
    architectureDependencies: {
      "x86_64": {
        darwin: deno_dom_release("libplugin.dylib"),
        linux: deno_dom_release("libplugin.so"),
        windows: deno_dom_release("plugin.dll"),
      },
      "aarch64": {
        linux: deno_dom_release("libplugin-linux-aarch64.so"),
        darwin: deno_dom_release_dragonstyle("libplugin.dylib")
      },
    },
  };
}
