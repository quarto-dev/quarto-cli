// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import * as path from "../path/mod.ts";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";
import { toPathString } from "./_util.ts";

/**
 * Ensures that the hard link exists.
 * If the directory structure does not exist, it is created.
 *
 * @param src the source file path. Directory hard links are not allowed.
 * @param dest the destination link path
 */
export async function ensureLink(src: string | URL, dest: string | URL) {
  dest = toPathString(dest);
  await ensureDir(path.dirname(dest));

  await Deno.link(toPathString(src), dest);
}

/**
 * Ensures that the hard link exists.
 * If the directory structure does not exist, it is created.
 *
 * @param src the source file path. Directory hard links are not allowed.
 * @param dest the destination link path
 */
export function ensureLinkSync(src: string | URL, dest: string | URL) {
  dest = toPathString(dest);
  ensureDirSync(path.dirname(dest));

  Deno.linkSync(toPathString(src), dest);
}
