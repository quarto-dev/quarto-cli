// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Copyright the Browserify authors. MIT License.

import { SEPARATOR } from "../path/constants.ts";
import { toPathString } from "./_to_path_string.ts";

/**
 * Test whether or not `dest` is a sub-directory of `src`
 * @param src src file path
 * @param dest dest file path
 * @param sep path separator
 */
export function isSubdir(
  src: string | URL,
  dest: string | URL,
  sep = SEPARATOR,
): boolean {
  if (src === dest) {
    return false;
  }
  src = toPathString(src);
  const srcArray = src.split(sep);
  dest = toPathString(dest);
  const destArray = dest.split(sep);
  return srcArray.every((current, i) => destArray[i] === current);
}
