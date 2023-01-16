// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { CallbackWithError } from "./_fs_common.ts";

export function ftruncate(
  fd: number,
  lenOrCallback: number | CallbackWithError,
  maybeCallback?: CallbackWithError,
) {
  const len: number | undefined = typeof lenOrCallback === "number"
    ? lenOrCallback
    : undefined;
  const callback: CallbackWithError = typeof lenOrCallback === "function"
    ? lenOrCallback
    : maybeCallback as CallbackWithError;

  if (!callback) throw new Error("No callback function supplied");

  Deno.ftruncate(fd, len).then(() => callback(null), callback);
}

export function ftruncateSync(fd: number, len?: number) {
  Deno.ftruncateSync(fd, len);
}
