/*
 * fixture
 */
import { join } from "../deno_ral/path.ts";
import { type FileInfo, lstatSync, readTextFileSync, statSync } from "../deno_ral/fs.ts";

export function readIt(dir: string): string {
  const info = statSync(dir);
  if (!info.isDirectory) {
    throw new Error("not a dir");
  }
  return readTextFileSync(join(dir, "a.txt"));
}

export function infoOf(path: string): FileInfo {
  return lstatSync(path);
}
