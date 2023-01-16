// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import type { CallbackWithError } from "./_fs_common.ts";
import { makeCallback } from "./_fs_common.ts";
import { Buffer } from "../buffer.ts";
import { getValidatedPath, getValidMode } from "../internal/fs/utils.mjs";
import { fs } from "../internal_binding/constants.ts";
import { codeMap } from "../internal_binding/uv.ts";
import { promisify } from "../internal/util.mjs";

export function copyFile(
  src: string | Buffer | URL,
  dest: string | Buffer | URL,
  callback: CallbackWithError,
): void;
export function copyFile(
  src: string | Buffer | URL,
  dest: string | Buffer | URL,
  mode: number,
  callback: CallbackWithError,
): void;
export function copyFile(
  src: string | Buffer | URL,
  dest: string | Buffer | URL,
  mode: number | CallbackWithError,
  callback?: CallbackWithError,
) {
  if (typeof mode === "function") {
    callback = mode;
    mode = 0;
  }
  const srcStr = getValidatedPath(src, "src").toString();
  const destStr = getValidatedPath(dest, "dest").toString();
  const modeNum = getValidMode(mode, "copyFile");
  const cb = makeCallback(callback);

  if ((modeNum & fs.COPYFILE_EXCL) === fs.COPYFILE_EXCL) {
    Deno.lstat(destStr).then(() => {
      // deno-lint-ignore no-explicit-any
      const e: any = new Error(
        `EEXIST: file already exists, copyfile '${srcStr}' -> '${destStr}'`,
      );
      e.syscall = "copyfile";
      e.errno = codeMap.get("EEXIST");
      e.code = "EEXIST";
      cb(e);
    }, (e) => {
      if (e instanceof Deno.errors.NotFound) {
        Deno.copyFile(srcStr, destStr).then(() => cb(null), cb);
      }
      cb(e);
    });
  } else {
    Deno.copyFile(srcStr, destStr).then(() => cb(null), cb);
  }
}

export const copyFilePromise = promisify(copyFile) as (
  src: string | Buffer | URL,
  dest: string | Buffer | URL,
  mode?: number,
) => Promise<void>;

export function copyFileSync(
  src: string | Buffer | URL,
  dest: string | Buffer | URL,
  mode?: number,
) {
  const srcStr = getValidatedPath(src, "src").toString();
  const destStr = getValidatedPath(dest, "dest").toString();
  const modeNum = getValidMode(mode, "copyFile");

  if ((modeNum & fs.COPYFILE_EXCL) === fs.COPYFILE_EXCL) {
    try {
      Deno.lstatSync(destStr);
      throw new Error(`A file exists at the destination: ${destStr}`);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        Deno.copyFileSync(srcStr, destStr);
      }
      throw e;
    }
  } else {
    Deno.copyFileSync(srcStr, destStr);
  }
}
