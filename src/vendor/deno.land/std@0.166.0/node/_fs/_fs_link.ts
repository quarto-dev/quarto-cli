// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import type { CallbackWithError } from "./_fs_common.ts";
import { fromFileUrl } from "../path.ts";
import { promisify } from "../internal/util.mjs";

/**
 * TODO: Also accept 'path' parameter as a Node polyfill Buffer type once these
 * are implemented. See https://github.com/denoland/deno/issues/3403
 */
export function link(
  existingPath: string | URL,
  newPath: string | URL,
  callback: CallbackWithError,
) {
  existingPath = existingPath instanceof URL
    ? fromFileUrl(existingPath)
    : existingPath;
  newPath = newPath instanceof URL ? fromFileUrl(newPath) : newPath;

  Deno.link(existingPath, newPath).then(() => callback(null), callback);
}

/**
 * TODO: Also accept 'path' parameter as a Node polyfill Buffer type once these
 * are implemented. See https://github.com/denoland/deno/issues/3403
 */
export const linkPromise = promisify(link) as (
  existingPath: string | URL,
  newPath: string | URL,
) => Promise<void>;

/**
 * TODO: Also accept 'path' parameter as a Node polyfill Buffer type once these
 * are implemented. See https://github.com/denoland/deno/issues/3403
 */
export function linkSync(
  existingPath: string | URL,
  newPath: string | URL,
) {
  existingPath = existingPath instanceof URL
    ? fromFileUrl(existingPath)
    : existingPath;
  newPath = newPath instanceof URL ? fromFileUrl(newPath) : newPath;

  Deno.linkSync(existingPath, newPath);
}
