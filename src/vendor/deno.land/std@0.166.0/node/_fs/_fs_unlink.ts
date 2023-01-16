// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { promisify } from "../internal/util.mjs";

export function unlink(path: string | URL, callback: (err?: Error) => void) {
  if (!callback) throw new Error("No callback function supplied");
  Deno.remove(path).then((_) => callback(), callback);
}

export const unlinkPromise = promisify(unlink) as (
  path: string | URL,
) => Promise<void>;

export function unlinkSync(path: string | URL) {
  Deno.removeSync(path);
}
