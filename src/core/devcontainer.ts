/*
 * devcontainer.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { walkSync } from "../vendor/deno.land/std@0.185.0/fs/walk.ts";
import { globToRegExp } from "./lib/glob.ts";

import { join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

const kDevContainerGlobs = [
  "",
  ".devcontainer/*/devcontainer.json",
];

export function hasDevContainer(dir: string) {
  // Devcontainer file in a hidden subdirectory
  if (existsSync(join(dir, ".devcontainer", "devcontainer.json"))) {
    return true;
  }

  // Devcontainer file in the root
  if (existsSync(join(dir, ".devcontainer.json"))) {
    return true;
  }

  // Devcontainer in a direct subdirectory child
  const containerRootDir = join(dir, ".devcontainer");
  if (existsSync(containerRootDir)) {
    for (
      const walk of walkSync(containerRootDir, {
        maxDepth: 1,
        includeFiles: false,
        includeDirs: true,
      })
    ) {
      if (existsSync(join(containerRootDir, walk.name, "devcontainer.json"))) {
        return true;
      }
    }
  }

  return false;
}
