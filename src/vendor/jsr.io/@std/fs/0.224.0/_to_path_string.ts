// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Copyright the Browserify authors. MIT License.

import { fromFileUrl } from "jsr:/@std/path@^0.224.0/from-file-url";

/**
 * Convert a URL or string to a path
 * @param pathUrl A URL or string to be converted
 */
export function toPathString(
  pathUrl: string | URL,
): string {
  return pathUrl instanceof URL ? fromFileUrl(pathUrl) : pathUrl;
}
