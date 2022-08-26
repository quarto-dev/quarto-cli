// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import * as path from "../path/mod.ts";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";
import { getFileInfoType } from "./_util.ts";
import { isWindows } from "../_util/os.ts";

/**
 * Ensures that the link exists.
 * If the directory structure does not exist, it is created.
 *
 * @param src the source file path
 * @param dest the destination link path
 */
export async function ensureSymlink(src: string, dest: string) {
  const srcStatInfo = await Deno.lstat(src);
  const srcFilePathType = getFileInfoType(srcStatInfo);

  await ensureDir(path.dirname(dest));

  const options: Deno.SymlinkOptions | undefined = isWindows
    ? {
      type: srcFilePathType === "dir" ? "dir" : "file",
    }
    : undefined;

  await Deno.symlink(src, dest, options);
}

/**
 * Ensures that the link exists.
 * If the directory structure does not exist, it is created.
 *
 * @param src the source file path
 * @param dest the destination link path
 */
export function ensureSymlinkSync(src: string, dest: string) {
  const srcStatInfo = Deno.lstatSync(src);
  const srcFilePathType = getFileInfoType(srcStatInfo);

  ensureDirSync(path.dirname(dest));

  const options: Deno.SymlinkOptions | undefined = isWindows
    ? {
      type: srcFilePathType === "dir" ? "dir" : "file",
    }
    : undefined;

  Deno.symlinkSync(src, dest, options);
}
