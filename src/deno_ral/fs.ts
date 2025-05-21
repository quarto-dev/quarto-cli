/*
 * encoding.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { fromFileUrl } from "./path.ts";
import { resolve, SEP as SEPARATOR } from "./path.ts";
import { copySync } from "fs/copy";
import { existsSync } from "fs/exists";

export { ensureDir, ensureDirSync } from "fs/ensure-dir";
export { existsSync } from "fs/exists";
export { walk, walkSync } from "fs/walk";
export { expandGlob, expandGlobSync } from "fs/expand-glob";
export type { ExpandGlobOptions } from "fs/expand-glob";
export { EOL, format, LF } from "fs/eol";
export { copy, copySync } from "fs/copy";
export type { CopyOptions } from "fs/copy";
export { moveSync } from "fs/move";
export { emptyDirSync } from "fs/empty-dir";
export type { WalkEntry } from "fs/walk";

// It looks like these exports disappeared when Deno moved to JSR? :(
// from https://jsr.io/@std/fs/1.0.3/_get_file_info_type.ts

export type PathType = "file" | "dir" | "symlink";
export function getFileInfoType(fileInfo: Deno.FileInfo): PathType | undefined {
  return fileInfo.isFile
    ? "file"
    : fileInfo.isDirectory
    ? "dir"
    : fileInfo.isSymlink
    ? "symlink"
    : undefined;
}

// from https://jsr.io/@std/fs/1.0.3/_is_subdir.ts
/**
 * Checks whether `path2` is a sub-directory of `path1`.
 *
 * The original function uses bad parameter names which are misleading.
 *
 * This function is such that, for all paths p:
 *
 * isSubdir(p, join(p, "foo")) === true
 * isSubdir(p, p)              === false
 * isSubdir(join(p, "foo"), p) === false
 *
 * @param path1 First path, as a string or URL.
 * @param path2 Second path, as a string or URL.
 * @param sep Path separator. Defaults to `\\` for Windows and `/` for other
 * platforms.
 *
 * @returns `true` if `path2` is a proper sub-directory of `path1`, `false` otherwise.
 */
export function isSubdir(
  path1: string | URL,
  path2: string | URL,
  sep = SEPARATOR,
): boolean {
  path1 = toPathString(path1);
  path2 = toPathString(path2);

  path1 = resolve(path1);
  path2 = resolve(path2);

  if (path1 === path2) {
    return false;
  }

  const path1Array = path1.split(sep);
  const path2Array = path2.split(sep);

  // if path1Array is longer than path2Array, then at least one of the
  // comparisons will return false, because it will compare a string to
  // undefined

  return path1Array.every((current, i) => path2Array[i] === current);
}

/**
 * Convert a URL or string to a path.
 *
 * @param pathUrl A URL or string to be converted.
 *
 * @returns The path as a string.
 */
export function toPathString(
  pathUrl: string | URL,
): string {
  return pathUrl instanceof URL ? fromFileUrl(pathUrl) : pathUrl;
}

export function safeMoveSync(
  src: string,
  dest: string,
): void {
  try {
    Deno.renameSync(src, dest);
    // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    // code isn't part of the generic error object, which is why we use `: any`
    if (err.code !== "EXDEV") {
      throw err;
    }
    copySync(src, dest, { overwrite: true });
    safeRemoveSync(src, { recursive: true });
  }
}

export function safeRemoveSync(
  file: string,
  options: Deno.RemoveOptions = {},
) {
  try {
    Deno.removeSync(file, options);
  } catch (e) {
    if (existsSync(file)) {
      throw e;
    }
  }
}

export class UnsafeRemovalError extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export function safeRemoveDirSync(
  path: string,
  boundary: string,
) {
  if (path === boundary || !isSubdir(boundary, path)) {
    throw new UnsafeRemovalError(
      `Refusing to remove directory ${path} that isn't a subdirectory of ${boundary}`,
    );
  }
  return safeRemoveSync(path, { recursive: true });
}

/**
 * Obtain the mode of a file in a windows-safe way.
 *
 * @param path The path to the file.
 *
 * @returns The mode of the file, or `undefined` if the mode cannot be obtained.
 */
export function safeModeFromFile(path: string): number | undefined {
  if (Deno.build.os !== "windows") {
    const stat = Deno.statSync(path);
    if (stat.mode !== null) {
      return stat.mode;
    }
  }
}
