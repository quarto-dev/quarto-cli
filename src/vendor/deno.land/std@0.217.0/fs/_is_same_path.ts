// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Copyright the Browserify authors. MIT License.

import { resolve } from "../path/resolve.ts";
import { toPathString } from "./_to_path_string.ts";

/**
 * Test whether `src` and `dest` resolve to the same location
 * @param src src file path
 * @param dest dest file path
 */
export function isSamePath(
  src: string | URL,
  dest: string | URL,
): boolean | void {
  src = toPathString(src);
  dest = toPathString(dest);

  return resolve(src) === resolve(dest);
}
