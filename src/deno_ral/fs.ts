/*
 * fs.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { fromFileUrl } from "./path.ts";
import { resolve, SEP as SEPARATOR } from "./path.ts";
import { copySync } from "fs/copy";
import { existsSync } from "fs/exists";
import { originalRealPathSync } from "./original-real-path.ts";
import { debug } from "./log.ts";
import { errorWithPath } from "./errors.ts";

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
export function getFileInfoType(fileInfo: FileInfo): PathType | undefined {
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
  options: { recursive?: boolean } = {},
) {
  try {
    Deno.removeSync(file, options);
  } catch (e) {
    if (existsSync(file)) {
      throw e;
    }
  }
}

// True only for an existing regular file; false for a directory, a missing
// path, or a path that cannot be stat'd.
export function safeExistsFileSync(path: string) {
  try {
    return existsSync(path) && Deno.statSync(path).isFile;
  } catch {
    return false;
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
  // Resolve symlinks so both sides compare the same physical path. External
  // tools (knitr, for example) may resolve symlinks while project.dir
  // preserves them.
  let resolvedPath = path;
  let resolvedBoundary = boundary;
  try {
    resolvedPath = canonicalPathSync(path);
    resolvedBoundary = canonicalPathSync(boundary);
  } catch {
    // If resolution fails (e.g., path doesn't exist), use original paths
  }

  if (resolvedPath === resolvedBoundary || !isSubdir(resolvedBoundary, resolvedPath)) {
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

/**
 * Set file mode in a platform-safe way. No-op on Windows (where chmod
 * is not supported). Swallows errors on other platforms since permission
 * changes are often non-fatal (e.g., on filesystems that don't support it).
 */
export function safeChmodSync(path: string, mode: number): void {
  if (Deno.build.os !== "windows") {
    try {
      Deno.chmodSync(path, mode);
    } catch (e) {
      debug(`safeChmodSync: failed to chmod ${path}: ${e}`);
    }
  }
}

/**
 * Ensure a file has user write permission. Files copied from installed
 * resources (e.g. system packages) may be read-only, but users expect
 * to edit files created by `quarto create`. No-op on Windows.
 */
export function ensureUserWritable(path: string): void {
  const mode = safeModeFromFile(path);
  if (mode !== undefined && !(mode & 0o200)) {
    safeChmodSync(path, mode | 0o200);
  }
}

// ---------------------------------------------------------------------------
// Plain filesystem calls, named after their Deno.* counterparts.
//
// Deno.* is looked up at call time on purpose: core/performance/metrics.ts
// reassigns Deno.readTextFileSync to record file reads.
// ---------------------------------------------------------------------------

export interface FileInfo {
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  mtime: Date | null;
  atime: Date | null;
  birthtime: Date | null;
  mode: number | null;
}

export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

export interface FsFile {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  read(p: Uint8Array): Promise<number | null>;
  write(p: Uint8Array): Promise<number>;
  writeSync(p: Uint8Array): number;
  close(): void;
}

export interface OpenOptions {
  read?: boolean;
  write?: boolean;
  append?: boolean;
  create?: boolean;
  truncate?: boolean;
  mode?: number;
}

export interface WriteOptions {
  append?: boolean;
  create?: boolean;
  mode?: number;
}

function toFileInfo(info: Deno.FileInfo): FileInfo {
  return {
    isFile: info.isFile,
    isDirectory: info.isDirectory,
    isSymlink: info.isSymlink,
    size: info.size,
    mtime: info.mtime,
    atime: info.atime,
    birthtime: info.birthtime,
    mode: info.mode,
  };
}

function toDirEntry(entry: Deno.DirEntry): DirEntry {
  return {
    name: entry.name,
    isFile: entry.isFile,
    isDirectory: entry.isDirectory,
    isSymlink: entry.isSymlink,
  };
}

function byName(a: DirEntry, b: DirEntry): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

// String(path) (the URL href for URLs) matches what core/deno/monkey-patch.ts
// appends (`"Path: " + path`), so errorWithPath stays idempotent when the
// monkey patch already annotated the error.
function annotate(e: unknown, path: string | URL): unknown {
  return e instanceof Error ? errorWithPath(e, String(path)) : e;
}

export function readTextFileSync(path: string | URL): string {
  try {
    return Deno.readTextFileSync(path);
  } catch (e) {
    throw annotate(e, path);
  }
}

export async function readTextFile(path: string | URL): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch (e) {
    throw annotate(e, path);
  }
}

export function readFileSync(path: string | URL): Uint8Array {
  try {
    return Deno.readFileSync(path);
  } catch (e) {
    throw annotate(e, path);
  }
}

export async function readFile(path: string | URL): Promise<Uint8Array> {
  try {
    return await Deno.readFile(path);
  } catch (e) {
    throw annotate(e, path);
  }
}

export function writeTextFileSync(
  path: string | URL,
  data: string,
  options?: WriteOptions,
): void {
  Deno.writeTextFileSync(path, data, options);
}

export function writeTextFile(
  path: string | URL,
  data: string,
  options?: WriteOptions,
): Promise<void> {
  return Deno.writeTextFile(path, data, options);
}

export function writeFileSync(
  path: string | URL,
  data: Uint8Array,
  options?: WriteOptions,
): void {
  Deno.writeFileSync(path, data, options);
}

export function writeFile(
  path: string | URL,
  data: Uint8Array,
  options?: WriteOptions,
): Promise<void> {
  return Deno.writeFile(path, data, options);
}

export function statSync(path: string | URL): FileInfo {
  return toFileInfo(Deno.statSync(path));
}

export async function stat(path: string | URL): Promise<FileInfo> {
  return toFileInfo(await Deno.stat(path));
}

export function lstatSync(path: string | URL): FileInfo {
  return toFileInfo(Deno.lstatSync(path));
}

export async function lstat(path: string | URL): Promise<FileInfo> {
  return toFileInfo(await Deno.lstat(path));
}

export function mkdirSync(
  path: string | URL,
  options?: { recursive?: boolean; mode?: number },
): void {
  Deno.mkdirSync(path, options);
}

export function mkdir(
  path: string | URL,
  options?: { recursive?: boolean; mode?: number },
): Promise<void> {
  return Deno.mkdir(path, options);
}

export function removeSync(
  path: string | URL,
  options?: { recursive?: boolean },
): void {
  Deno.removeSync(path, options);
}

export function remove(
  path: string | URL,
  options?: { recursive?: boolean },
): Promise<void> {
  return Deno.remove(path, options);
}

export function renameSync(oldPath: string | URL, newPath: string | URL): void {
  Deno.renameSync(oldPath, newPath);
}

export function rename(
  oldPath: string | URL,
  newPath: string | URL,
): Promise<void> {
  return Deno.rename(oldPath, newPath);
}

export function copyFileSync(from: string | URL, to: string | URL): void {
  Deno.copyFileSync(from, to);
}

export function copyFile(from: string | URL, to: string | URL): Promise<void> {
  return Deno.copyFile(from, to);
}

/** Directory entries sorted by name (code-unit order). */
export function readDirSync(path: string | URL): DirEntry[] {
  return Array.from(Deno.readDirSync(path), toDirEntry).sort(byName);
}

/** Directory entries sorted by name (code-unit order). */
export async function* readDir(path: string | URL): AsyncIterable<DirEntry> {
  const entries: DirEntry[] = [];
  for await (const entry of Deno.readDir(path)) {
    entries.push(toDirEntry(entry));
  }
  entries.sort(byName);
  yield* entries;
}

export function symlinkSync(
  target: string | URL,
  path: string | URL,
  options?: { type?: "file" | "dir" },
): void {
  // Deno.SymlinkOptions.type is required in Deno 2's types; pass options only
  // when a type was given so a bare `symlinkSync(a, b)` stays options-free.
  Deno.symlinkSync(
    target,
    path,
    options?.type !== undefined ? { type: options.type } : undefined,
  );
}

export function symlink(
  target: string | URL,
  path: string | URL,
  options?: { type?: "file" | "dir" },
): Promise<void> {
  return Deno.symlink(
    target,
    path,
    options?.type !== undefined ? { type: options.type } : undefined,
  );
}

export function readLinkSync(path: string | URL): string {
  return Deno.readLinkSync(path);
}

/** Resolves symlinks (the un-patched Deno.realPath behaviour). */
export function realPath(path: string | URL): Promise<string> {
  return Deno.realPath(path);
}

/**
 * The canonical absolute path: symlinks resolved, and no Windows `\\?\` prefix
 * (Deno strips it itself, so nothing is sliced here). Throws when the path
 * does not exist. core/deno/monkey-patch.ts patches Deno.realPathSync to
 * normalizePath, so the saved original is called.
 */
export function canonicalPathSync(path: string | URL): string {
  return originalRealPathSync(path);
}

export function chmodSync(path: string | URL, mode: number): void {
  Deno.chmodSync(path, mode);
}

export function chmod(path: string | URL, mode: number): Promise<void> {
  return Deno.chmod(path, mode);
}

export function utimeSync(
  path: string | URL,
  atime: number | Date,
  mtime: number | Date,
): void {
  Deno.utimeSync(path, atime, mtime);
}

export function truncateSync(path: string | URL, len?: number): void {
  // Deno.truncateSync's types take string only (no URL).
  Deno.truncateSync(toPathString(path), len);
}

export function open(path: string | URL, options?: OpenOptions): Promise<FsFile> {
  return Deno.open(path, options);
}

export function openSync(path: string | URL, options?: OpenOptions): FsFile {
  return Deno.openSync(path, options);
}

export function create(path: string | URL): Promise<FsFile> {
  return Deno.create(path);
}
