/*
* render-paths.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";

import { inputFilesDir } from "../../core/render.ts";

export function filesDirLibDir(input: string) {
  return join(inputFilesDir(input), "libs");
}

export function pandocMetadataPath(path: string) {
  return pathWithForwardSlashes(path);
}
