/*
* monkey-patch.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { isWindows } from "../platform.ts";
import { fromFileUrl, isAbsolute, join, normalize } from "path/mod.ts";

if (isWindows()) {
  // Window UNC paths can be mishandled by realPathSync
  // (see https://github.com/quarto-dev/quarto-vscode/issues/67)
  // so we monkey-patch to implement the absolute path and normalize
  // parts of realPathSync (we aren't interested in the symlink
  // resolution, and certainly not on windows that has no symlinks!)
  Deno.realPathSync = function (path: string | URL) {
    let file = path instanceof URL ? fromFileUrl(path) : path;
    if (!isAbsolute(file)) {
      file = join(Deno.cwd(), file);
    }
    file = normalize(file);
    // some runtimes (e.g. nodejs) create paths w/ lowercase drive
    // letters, make those uppercase
    return file.replace(/^\w:\\/, (m) => m[0].toUpperCase() + ":\\");
  };
}
