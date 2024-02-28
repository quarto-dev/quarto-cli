// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Copyright the Browserify authors. MIT License.

import { basename } from "../path/basename.ts";
import { normalize } from "../path/normalize.ts";
import { toPathString } from "./_to_path_string.ts";

/**
 * Walk entry for {@linkcode walk}, {@linkcode walkSync},
 * {@linkcode expandGlob} and {@linkcode expandGlobSync}.
 */
export interface WalkEntry extends Deno.DirEntry {
  /** Full path of the entry. */
  path: string;
}

/** Create {@linkcode WalkEntry} for the `path` synchronously. */
export function createWalkEntrySync(path: string | URL): WalkEntry {
  path = toPathString(path);
  path = normalize(path);
  const name = basename(path);
  const info = Deno.statSync(path);
  return {
    path,
    name,
    isFile: info.isFile,
    isDirectory: info.isDirectory,
    isSymlink: info.isSymlink,
  };
}

/** Create {@linkcode WalkEntry} for the `path` asynchronously. */
export async function createWalkEntry(path: string | URL): Promise<WalkEntry> {
  path = toPathString(path);
  path = normalize(path);
  const name = basename(path);
  const info = await Deno.stat(path);
  return {
    path,
    name,
    isFile: info.isFile,
    isDirectory: info.isDirectory,
    isSymlink: info.isSymlink,
  };
}
