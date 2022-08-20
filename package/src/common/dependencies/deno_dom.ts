/*
* deno_dom.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureDir } from "fs/mod.ts";
import { basename, dirname, join } from "path/mod.ts";

import { Dependency } from "./dependencies.ts";

export function deno_dom(version: string): Dependency {
  const deno_dom_release = (filename: string) => {
    return {
      filename,
      url:
        `https://github.com/b-fuze/deno-dom/releases/download/${version}/${filename}`,
      configure: async (path: string) => {
        const targetPath = join(dirname(path), "deno_dom", basename(path));
        await ensureDir(dirname(targetPath));
        await Deno.copyFile(path, targetPath);
      },
    };
  };

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
    },
  };
}
