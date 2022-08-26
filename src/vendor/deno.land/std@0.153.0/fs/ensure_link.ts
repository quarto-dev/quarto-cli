// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import * as path from "../path/mod.ts";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";

/**
 * Ensures that the hard link exists.
 * If the directory structure does not exist, it is created.
 *
 * @param src the source file path. Directory hard links are not allowed.
 * @param dest the destination link path
 */
export async function ensureLink(src: string, dest: string) {
  await ensureDir(path.dirname(dest));

  await Deno.link(src, dest);
}

/**
 * Ensures that the hard link exists.
 * If the directory structure does not exist, it is created.
 *
 * @param src the source file path. Directory hard links are not allowed.
 * @param dest the destination link path
 */
export function ensureLinkSync(src: string, dest: string) {
  ensureDirSync(path.dirname(dest));

  Deno.linkSync(src, dest);
}
