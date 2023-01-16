// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { CallbackWithError } from "./_fs_common.ts";
import { fromFileUrl } from "../path.ts";
import { promisify } from "../internal/util.mjs";

export function truncate(
  path: string | URL,
  lenOrCallback: number | CallbackWithError,
  maybeCallback?: CallbackWithError,
) {
  path = path instanceof URL ? fromFileUrl(path) : path;
  const len: number | undefined = typeof lenOrCallback === "number"
    ? lenOrCallback
    : undefined;
  const callback: CallbackWithError = typeof lenOrCallback === "function"
    ? lenOrCallback
    : maybeCallback as CallbackWithError;

  if (!callback) throw new Error("No callback function supplied");

  Deno.truncate(path, len).then(() => callback(null), callback);
}

export const truncatePromise = promisify(truncate) as (
  path: string | URL,
  len?: number,
) => Promise<void>;

export function truncateSync(path: string | URL, len?: number) {
  path = path instanceof URL ? fromFileUrl(path) : path;

  Deno.truncateSync(path, len);
}
