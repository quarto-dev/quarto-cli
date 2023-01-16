// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import type { CallbackWithError } from "./_fs_common.ts";
import { promisify } from "../internal/util.mjs";
import { denoErrorToNodeError } from "../internal/errors.ts";
import { getValidatedPath } from "../internal/fs/utils.mjs";
import { validateBoolean } from "../internal/validators.mjs";

/**
 * TODO: Also accept 'path' parameter as a Node polyfill Buffer type once these
 * are implemented. See https://github.com/denoland/deno/issues/3403
 */
type MkdirOptions =
  | { recursive?: boolean; mode?: number | undefined }
  | number
  | boolean;

export function mkdir(
  path: string | URL,
  options?: MkdirOptions | CallbackWithError,
  callback?: CallbackWithError,
) {
  path = getValidatedPath(path) as string;

  let mode = 0o777;
  let recursive = false;

  if (typeof options == "function") {
    callback = options;
  } else if (typeof options === "number") {
    mode = options;
  } else if (typeof options === "boolean") {
    recursive = options;
  } else if (options) {
    if (options.recursive !== undefined) recursive = options.recursive;
    if (options.mode !== undefined) mode = options.mode;
  }
  validateBoolean(recursive, "options.recursive");

  Deno.mkdir(path, { recursive, mode })
    .then(() => {
      if (typeof callback === "function") {
        callback(null);
      }
    }, (err) => {
      if (typeof callback === "function") {
        callback(err);
      }
    });
}

export const mkdirPromise = promisify(mkdir) as (
  path: string | URL,
  options?: MkdirOptions,
) => Promise<void>;

export function mkdirSync(path: string | URL, options?: MkdirOptions) {
  path = getValidatedPath(path) as string;

  let mode = 0o777;
  let recursive = false;

  if (typeof options === "number") {
    mode = options;
  } else if (typeof options === "boolean") {
    recursive = options;
  } else if (options) {
    if (options.recursive !== undefined) recursive = options.recursive;
    if (options.mode !== undefined) mode = options.mode;
  }
  validateBoolean(recursive, "options.recursive");

  try {
    Deno.mkdirSync(path, { recursive, mode });
  } catch (err) {
    throw denoErrorToNodeError(err as Error, { syscall: "mkdir", path });
  }
}
