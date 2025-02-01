// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { dirname } from "jsr:/@std/path@^0.224.0/dirname";
import { resolve } from "jsr:/@std/path@^0.224.0/resolve";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";
import { getFileInfoType } from "./_get_file_info_type.ts";
import { toPathString } from "./_to_path_string.ts";

const isWindows = Deno.build.os === "windows";

function resolveSymlinkTarget(target: string | URL, linkName: string | URL) {
  if (typeof target !== "string") return target; // URL is always absolute path
  if (typeof linkName === "string") {
    return resolve(dirname(linkName), target);
  } else {
    return new URL(target, linkName);
  }
}

/**
 * Asynchronously ensures that the link exists, and points to a valid file. If
 * the directory structure does not exist, it is created. If the link already
 * exists, it is not modified but error is thrown if it is not point to the
 * given target.
 *
 * Requires the `--allow-read` and `--allow-write` flag.
 *
 * @param target The source file path as a string or URL.
 * @param linkName The destination link path as a string or URL.
 * @returns A void promise that resolves once the link exists.
 *
 * @example
 * ```ts
 * import { ensureSymlink } from "@std/fs/ensure-symlink";
 *
 * await ensureSymlink("./folder/targetFile.dat", "./folder/targetFile.link.dat");
 * ```
 */
export async function ensureSymlink(
  target: string | URL,
  linkName: string | URL,
) {
  const targetRealPath = resolveSymlinkTarget(target, linkName);
  const srcStatInfo = await Deno.lstat(targetRealPath);
  const srcFilePathType = getFileInfoType(srcStatInfo);

  await ensureDir(dirname(toPathString(linkName)));

  const options: Deno.SymlinkOptions | undefined = isWindows
    ? {
      type: srcFilePathType === "dir" ? "dir" : "file",
    }
    : undefined;

  try {
    await Deno.symlink(target, linkName, options);
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
    const linkStatInfo = await Deno.lstat(linkName);
    if (!linkStatInfo.isSymlink) {
      const type = getFileInfoType(linkStatInfo);
      throw new Deno.errors.AlreadyExists(
        `A '${type}' already exists at the path: ${linkName}`,
      );
    }
    const linkPath = await Deno.readLink(linkName);
    const linkRealPath = resolve(linkPath);
    if (linkRealPath !== targetRealPath) {
      throw new Deno.errors.AlreadyExists(
        `A symlink targeting to an undesired path already exists: ${linkName} -> ${linkRealPath}`,
      );
    }
  }
}

/**
 * Synchronously ensures that the link exists, and points to a valid file. If
 * the directory structure does not exist, it is created. If the link already
 * exists, it is not modified but error is thrown if it is not point to the
 * given target.
 *
 * Requires the `--allow-read` and `--allow-write` flag.
 *
 * @param target The source file path as a string or URL.
 * @param linkName The destination link path as a string or URL.
 * @returns A void value that returns once the link exists.
 *
 * @example
 * ```ts
 * import { ensureSymlinkSync } from "@std/fs/ensure-symlink";
 *
 * ensureSymlinkSync("./folder/targetFile.dat", "./folder/targetFile.link.dat");
 * ```
 */
export function ensureSymlinkSync(
  target: string | URL,
  linkName: string | URL,
) {
  const targetRealPath = resolveSymlinkTarget(target, linkName);
  const srcStatInfo = Deno.lstatSync(targetRealPath);
  const srcFilePathType = getFileInfoType(srcStatInfo);

  ensureDirSync(dirname(toPathString(linkName)));

  const options: Deno.SymlinkOptions | undefined = isWindows
    ? {
      type: srcFilePathType === "dir" ? "dir" : "file",
    }
    : undefined;

  try {
    Deno.symlinkSync(target, linkName, options);
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
    const linkStatInfo = Deno.lstatSync(linkName);
    if (!linkStatInfo.isSymlink) {
      const type = getFileInfoType(linkStatInfo);
      throw new Deno.errors.AlreadyExists(
        `A '${type}' already exists at the path: ${linkName}`,
      );
    }
    const linkPath = Deno.readLinkSync(linkName);
    const linkRealPath = resolve(linkPath);
    if (linkRealPath !== targetRealPath) {
      throw new Deno.errors.AlreadyExists(
        `A symlink targeting to an undesired path already exists: ${linkName} -> ${linkRealPath}`,
      );
    }
  }
}
