// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { type CallbackWithError, makeCallback } from "./_fs_common.ts";
import { getValidatedPath, kMaxUserId } from "../internal/fs/utils.mjs";
import * as pathModule from "../../path/mod.ts";
import { validateInteger } from "../internal/validators.mjs";
import type { Buffer } from "../buffer.ts";
import { promisify } from "../internal/util.mjs";

/**
 * Asynchronously changes the owner and group
 * of a file.
 */
export function chown(
  path: string | Buffer | URL,
  uid: number,
  gid: number,
  callback: CallbackWithError,
) {
  callback = makeCallback(callback);
  path = getValidatedPath(path).toString();
  validateInteger(uid, "uid", -1, kMaxUserId);
  validateInteger(gid, "gid", -1, kMaxUserId);

  Deno.chown(pathModule.toNamespacedPath(path), uid, gid).then(
    () => callback(null),
    callback,
  );
}

export const chownPromise = promisify(chown) as (
  path: string | Buffer | URL,
  uid: number,
  gid: number,
) => Promise<void>;

/**
 * Synchronously changes the owner and group
 * of a file.
 */
export function chownSync(
  path: string | Buffer | URL,
  uid: number,
  gid: number,
) {
  path = getValidatedPath(path).toString();
  validateInteger(uid, "uid", -1, kMaxUserId);
  validateInteger(gid, "gid", -1, kMaxUserId);

  Deno.chownSync(pathModule.toNamespacedPath(path), uid, gid);
}
