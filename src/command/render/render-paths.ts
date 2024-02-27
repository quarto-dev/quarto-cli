/*
* render-paths.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { join } from "../../deno_ral/path.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";

import { inputFilesDir } from "../../core/render.ts";

export function filesDirLibDir(input: string) {
  return join(inputFilesDir(input), "libs");
}

export function filesDirMediabagDir(input: string) {
  return join(inputFilesDir(input), "mediabag");
}

export function pandocMetadataPath(path: string) {
  return pathWithForwardSlashes(path);
}
