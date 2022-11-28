// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { CallbackWithError } from "./_fs_common.ts";

export function fdatasync(
  fd: number,
  callback: CallbackWithError,
) {
  Deno.fdatasync(fd).then(() => callback(null), callback);
}

export function fdatasyncSync(fd: number) {
  Deno.fdatasyncSync(fd);
}
