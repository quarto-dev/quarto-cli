// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import * as path from "../path/mod.ts";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";
import { getFileInfoType, toPathString } from "./_util.ts";
import { isWindows } from "../_util/os.ts";

/**
 * Ensures that the link exists.
 * If the directory structure does not exist, it is created.
 *
 * @param src the source file path
 * @param dest the destination link path
 */
export async function ensureSymlink(src: string | URL, dest: string | URL) {
  const srcStatInfo = await Deno.lstat(src);
  const srcFilePathType = getFileInfoType(srcStatInfo);

  await ensureDir(path.dirname(toPathString(dest)));

  const options: Deno.SymlinkOptions | undefined = isWindows
    ? {
      type: srcFilePathType === "dir" ? "dir" : "file",
    }
    : undefined;

  try {
    await Deno.symlink(src, dest, options);
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

/**
 * Ensures that the link exists.
 * If the directory structure does not exist, it is created.
 *
 * @param src the source file path
 * @param dest the destination link path
 */
export function ensureSymlinkSync(src: string | URL, dest: string | URL) {
  const srcStatInfo = Deno.lstatSync(src);
  const srcFilePathType = getFileInfoType(srcStatInfo);

  ensureDirSync(path.dirname(toPathString(dest)));

  const options: Deno.SymlinkOptions | undefined = isWindows
    ? {
      type: srcFilePathType === "dir" ? "dir" : "file",
    }
    : undefined;

  try {
    Deno.symlinkSync(src, dest, options);
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}
