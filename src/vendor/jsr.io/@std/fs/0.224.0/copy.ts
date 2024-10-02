// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { basename } from "jsr:/@std/path@^0.224.0/basename";
import { join } from "jsr:/@std/path@^0.224.0/join";
import { resolve } from "jsr:/@std/path@^0.224.0/resolve";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";
import { assert } from "jsr:/@std/assert@^0.224.0/assert";
import { getFileInfoType } from "./_get_file_info_type.ts";
import { toPathString } from "./_to_path_string.ts";
import { isSubdir } from "./_is_subdir.ts";

const isWindows = Deno.build.os === "windows";

/** Options for {@linkcode copy} and {@linkcode copySync}. */
export interface CopyOptions {
  /**
   * Whether to overwrite existing file or directory.
   *
   * @default {false}
   */
  overwrite?: boolean;
  /**
   * When `true`, will set last modification and access times to the ones of
   * the original source files. When `false`, timestamp behavior is
   * OS-dependent.
   *
   * @default {false}
   */
  preserveTimestamps?: boolean;
}

interface InternalCopyOptions extends CopyOptions {
  /** @default {false} */
  isFolder?: boolean;
}

async function ensureValidCopy(
  src: string | URL,
  dest: string | URL,
  options: InternalCopyOptions,
): Promise<Deno.FileInfo | undefined> {
  let destStat: Deno.FileInfo;

  try {
    destStat = await Deno.lstat(dest);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return;
    }
    throw err;
  }

  if (options.isFolder && !destStat.isDirectory) {
    throw new Error(
      `Cannot overwrite non-directory '${dest}' with directory '${src}'.`,
    );
  }
  if (!options.overwrite) {
    throw new Deno.errors.AlreadyExists(`'${dest}' already exists.`);
  }

  return destStat;
}

function ensureValidCopySync(
  src: string | URL,
  dest: string | URL,
  options: InternalCopyOptions,
): Deno.FileInfo | undefined {
  let destStat: Deno.FileInfo;
  try {
    destStat = Deno.lstatSync(dest);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return;
    }
    throw err;
  }

  if (options.isFolder && !destStat.isDirectory) {
    throw new Error(
      `Cannot overwrite non-directory '${dest}' with directory '${src}'.`,
    );
  }
  if (!options.overwrite) {
    throw new Deno.errors.AlreadyExists(`'${dest}' already exists.`);
  }

  return destStat;
}

/* copy file to dest */
async function copyFile(
  src: string | URL,
  dest: string | URL,
  options: InternalCopyOptions,
) {
  await ensureValidCopy(src, dest, options);
  await Deno.copyFile(src, dest);
  if (options.preserveTimestamps) {
    const statInfo = await Deno.stat(src);
    assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
    assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
    await Deno.utime(dest, statInfo.atime, statInfo.mtime);
  }
}
/* copy file to dest synchronously */
function copyFileSync(
  src: string | URL,
  dest: string | URL,
  options: InternalCopyOptions,
) {
  ensureValidCopySync(src, dest, options);
  Deno.copyFileSync(src, dest);
  if (options.preserveTimestamps) {
    const statInfo = Deno.statSync(src);
    assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
    assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
    Deno.utimeSync(dest, statInfo.atime, statInfo.mtime);
  }
}

/* copy symlink to dest */
async function copySymLink(
  src: string | URL,
  dest: string | URL,
  options: InternalCopyOptions,
) {
  await ensureValidCopy(src, dest, options);
  const originSrcFilePath = await Deno.readLink(src);
  const type = getFileInfoType(await Deno.lstat(src));
  if (isWindows) {
    await Deno.symlink(originSrcFilePath, dest, {
      type: type === "dir" ? "dir" : "file",
    });
  } else {
    await Deno.symlink(originSrcFilePath, dest);
  }
  if (options.preserveTimestamps) {
    const statInfo = await Deno.lstat(src);
    assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
    assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
    await Deno.utime(dest, statInfo.atime, statInfo.mtime);
  }
}

/* copy symlink to dest synchronously */
function copySymlinkSync(
  src: string | URL,
  dest: string | URL,
  options: InternalCopyOptions,
) {
  ensureValidCopySync(src, dest, options);
  const originSrcFilePath = Deno.readLinkSync(src);
  const type = getFileInfoType(Deno.lstatSync(src));
  if (isWindows) {
    Deno.symlinkSync(originSrcFilePath, dest, {
      type: type === "dir" ? "dir" : "file",
    });
  } else {
    Deno.symlinkSync(originSrcFilePath, dest);
  }

  if (options.preserveTimestamps) {
    const statInfo = Deno.lstatSync(src);
    assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
    assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
    Deno.utimeSync(dest, statInfo.atime, statInfo.mtime);
  }
}

/* copy folder from src to dest. */
async function copyDir(
  src: string | URL,
  dest: string | URL,
  options: CopyOptions,
) {
  const destStat = await ensureValidCopy(src, dest, {
    ...options,
    isFolder: true,
  });

  if (!destStat) {
    await ensureDir(dest);
  }

  if (options.preserveTimestamps) {
    const srcStatInfo = await Deno.stat(src);
    assert(srcStatInfo.atime instanceof Date, `statInfo.atime is unavailable`);
    assert(srcStatInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
    await Deno.utime(dest, srcStatInfo.atime, srcStatInfo.mtime);
  }

  src = toPathString(src);
  dest = toPathString(dest);

  const promises = [];

  for await (const entry of Deno.readDir(src)) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, basename(srcPath as string));
    if (entry.isSymlink) {
      promises.push(copySymLink(srcPath, destPath, options));
    } else if (entry.isDirectory) {
      promises.push(copyDir(srcPath, destPath, options));
    } else if (entry.isFile) {
      promises.push(copyFile(srcPath, destPath, options));
    }
  }

  await Promise.all(promises);
}

/* copy folder from src to dest synchronously */
function copyDirSync(
  src: string | URL,
  dest: string | URL,
  options: CopyOptions,
) {
  const destStat = ensureValidCopySync(src, dest, {
    ...options,
    isFolder: true,
  });

  if (!destStat) {
    ensureDirSync(dest);
  }

  if (options.preserveTimestamps) {
    const srcStatInfo = Deno.statSync(src);
    assert(srcStatInfo.atime instanceof Date, `statInfo.atime is unavailable`);
    assert(srcStatInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
    Deno.utimeSync(dest, srcStatInfo.atime, srcStatInfo.mtime);
  }

  src = toPathString(src);
  dest = toPathString(dest);

  for (const entry of Deno.readDirSync(src)) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, basename(srcPath as string));
    if (entry.isSymlink) {
      copySymlinkSync(srcPath, destPath, options);
    } else if (entry.isDirectory) {
      copyDirSync(srcPath, destPath, options);
    } else if (entry.isFile) {
      copyFileSync(srcPath, destPath, options);
    }
  }
}

/**
 * Asynchronously copy a file or directory. The directory can have contents.
 * Like `cp -r`.
 *
 * If `src` is a directory it will copy everything inside of this directory,
 * not the entire directory itself. If `src` is a file, `dest` cannot be a
 * directory.
 *
 * Requires the `--allow-read` and `--allow-write` flag.
 *
 * @param src The source file/directory path as a string or URL.
 * @param dest The destination file/directory path as a string or URL.
 * @param options Options for copying.
 * @returns A promise that resolves once the copy operation completes.
 *
 * @example Basic usage
 * ```ts
 * import { copy } from "@std/fs/copy";
 *
 * await copy("./foo", "./bar");
 * ```
 *
 * This will copy the file or directory at `./foo` to `./bar` without
 * overwriting.
 *
 * @example Overwriting files/directories
 * ```ts
 * import { copy } from "@std/fs/copy";
 *
 * await copy("./foo", "./bar", { overwrite: true });
 * ```
 *
 * This will copy the file or directory at `./foo` to `./bar` and overwrite
 * any existing files or directories.
 *
 * @example Preserving timestamps
 * ```ts
 * import { copy } from "@std/fs/copy";
 *
 * await copy("./foo", "./bar", { preserveTimestamps: true });
 * ```
 *
 * This will copy the file or directory at `./foo` to `./bar` and set the
 * last modification and access times to the ones of the original source files.
 */
export async function copy(
  src: string | URL,
  dest: string | URL,
  options: CopyOptions = {},
) {
  src = resolve(toPathString(src));
  dest = resolve(toPathString(dest));

  if (src === dest) {
    throw new Error("Source and destination cannot be the same.");
  }

  const srcStat = await Deno.lstat(src);

  if (srcStat.isDirectory && isSubdir(src, dest)) {
    throw new Error(
      `Cannot copy '${src}' to a subdirectory of itself, '${dest}'.`,
    );
  }

  if (srcStat.isSymlink) {
    await copySymLink(src, dest, options);
  } else if (srcStat.isDirectory) {
    await copyDir(src, dest, options);
  } else if (srcStat.isFile) {
    await copyFile(src, dest, options);
  }
}

/**
 * Synchronously copy a file or directory. The directory can have contents.
 * Like `cp -r`.
 *
 * If `src` is a directory it will copy everything inside of this directory,
 * not the entire directory itself. If `src` is a file, `dest` cannot be a
 * directory.
 *
 * Requires the `--allow-read` and `--allow-write` flag.
 *
 * @param src The source file/directory path as a string or URL.
 * @param dest The destination file/directory path as a string or URL.
 * @param options Options for copying.
 * @returns A void value that returns once the copy operation completes.
 *
 * @example Basic usage
 * ```ts
 * import { copySync } from "@std/fs/copy";
 *
 * copySync("./foo", "./bar");
 * ```
 *
 * This will copy the file or directory at `./foo` to `./bar` without
 * overwriting.
 *
 * @example Overwriting files/directories
 * ```ts
 * import { copySync } from "@std/fs/copy";
 *
 * copySync("./foo", "./bar", { overwrite: true });
 * ```
 *
 * This will copy the file or directory at `./foo` to `./bar` and overwrite
 * any existing files or directories.
 *
 * @example Preserving timestamps
 * ```ts
 * import { copySync } from "@std/fs/copy";
 *
 * copySync("./foo", "./bar", { preserveTimestamps: true });
 * ```
 *
 * This will copy the file or directory at `./foo` to `./bar` and set the
 * last modification and access times to the ones of the original source files.
 */
export function copySync(
  src: string | URL,
  dest: string | URL,
  options: CopyOptions = {},
) {
  src = resolve(toPathString(src));
  dest = resolve(toPathString(dest));

  if (src === dest) {
    throw new Error("Source and destination cannot be the same.");
  }

  const srcStat = Deno.lstatSync(src);

  if (srcStat.isDirectory && isSubdir(src, dest)) {
    throw new Error(
      `Cannot copy '${src}' to a subdirectory of itself, '${dest}'.`,
    );
  }

  if (srcStat.isSymlink) {
    copySymlinkSync(src, dest, options);
  } else if (srcStat.isDirectory) {
    copyDirSync(src, dest, options);
  } else if (srcStat.isFile) {
    copyFileSync(src, dest, options);
  }
}
