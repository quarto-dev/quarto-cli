// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import type { CallbackWithError } from "./_fs_common.ts";

function getValidTime(
  time: number | string | Date,
  name: string,
): number | Date {
  if (typeof time === "string") {
    time = Number(time);
  }

  if (
    typeof time === "number" &&
    (Number.isNaN(time) || !Number.isFinite(time))
  ) {
    throw new Deno.errors.InvalidData(
      `invalid ${name}, must not be infinity or NaN`,
    );
  }

  return time;
}

export function futimes(
  fd: number,
  atime: number | string | Date,
  mtime: number | string | Date,
  callback: CallbackWithError,
) {
  if (!callback) {
    throw new Deno.errors.InvalidData("No callback function supplied");
  }

  atime = getValidTime(atime, "atime");
  mtime = getValidTime(mtime, "mtime");

  Deno.futime(fd, atime, mtime).then(() => callback(null), callback);
}

export function futimesSync(
  fd: number,
  atime: number | string | Date,
  mtime: number | string | Date,
) {
  atime = getValidTime(atime, "atime");
  mtime = getValidTime(mtime, "mtime");

  Deno.futimeSync(fd, atime, mtime);
}
