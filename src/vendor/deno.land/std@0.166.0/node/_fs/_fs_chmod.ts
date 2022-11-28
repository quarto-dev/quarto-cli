// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import type { CallbackWithError } from "./_fs_common.ts";
import { getValidatedPath } from "../internal/fs/utils.mjs";
import * as pathModule from "../../path/mod.ts";
import { parseFileMode } from "../internal/validators.mjs";
import { Buffer } from "../buffer.ts";
import { promisify } from "../internal/util.mjs";

export function chmod(
  path: string | Buffer | URL,
  mode: string | number,
  callback: CallbackWithError,
) {
  path = getValidatedPath(path).toString();
  mode = parseFileMode(mode, "mode");

  Deno.chmod(pathModule.toNamespacedPath(path), mode).then(
    () => callback(null),
    callback,
  );
}

export const chmodPromise = promisify(chmod) as (
  path: string | Buffer | URL,
  mode: string | number,
) => Promise<void>;

export function chmodSync(path: string | URL, mode: string | number) {
  path = getValidatedPath(path).toString();
  mode = parseFileMode(mode, "mode");

  Deno.chmodSync(pathModule.toNamespacedPath(path), mode);
}
