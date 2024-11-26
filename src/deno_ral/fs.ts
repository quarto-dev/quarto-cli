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
// 2024-15-11: isSubDir("foo", "foo/bar") returns true, which gets src and dest exactly backwards?!
/**
 * Checks whether `src` is a sub-directory of `dest`.
 *
 * @param src Source file path as a string or URL.
 * @param dest Destination file path as a string or URL.
 * @param sep Path separator. Defaults to `\\` for Windows and `/` for other
 * platforms.
 *
 * @returns `true` if `src` is a sub-directory of `dest`, `false` otherwise.
 */
export function isSubdir(
  src: string | URL,
  dest: string | URL,
  sep = SEPARATOR,
): boolean {
  src = toPathString(src);
  dest = toPathString(dest);

  if (resolve(src) === resolve(dest)) {
    return false;
  }

  const srcArray = src.split(sep);
  const destArray = dest.split(sep);

  return srcArray.every((current, i) => destArray[i] === current);
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
  } catch (err) {
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
  // note the comment above about isSubdir getting src and dest backwards
  if (path === boundary || isSubdir(path, boundary)) {
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
