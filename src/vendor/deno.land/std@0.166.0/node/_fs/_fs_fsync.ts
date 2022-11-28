// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { CallbackWithError } from "./_fs_common.ts";

export function fsync(
  fd: number,
  callback: CallbackWithError,
) {
  Deno.fsync(fd).then(() => callback(null), callback);
}

export function fsyncSync(fd: number) {
  Deno.fsyncSync(fd);
}
