// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import * as path from "../path/mod.ts";
import { basename, fromFileUrl, normalize } from "../path/mod.ts";

/**
 * Test whether or not `dest` is a sub-directory of `src`
 * @param src src file path
 * @param dest dest file path
 * @param sep path separator
 */
export function isSubdir(
  src: string | URL,
  dest: string | URL,
  sep: string = path.sep,
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

export type PathType = "file" | "dir" | "symlink";

/**
 * Get a human readable file type string.
 *
 * @param fileInfo A FileInfo describes a file and is returned by `stat`,
 *                 `lstat`
 */
export function getFileInfoType(fileInfo: Deno.FileInfo): PathType | undefined {
  return fileInfo.isFile
    ? "file"
    : fileInfo.isDirectory
    ? "dir"
    : fileInfo.isSymlink
    ? "symlink"
    : undefined;
}

export interface WalkEntry extends Deno.DirEntry {
  path: string;
}

/** Create WalkEntry for the `path` synchronously */
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

/** Create WalkEntry for the `path` asynchronously */
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

export function toPathString(path: string | URL): string {
  return path instanceof URL ? fromFileUrl(path) : path;
}
