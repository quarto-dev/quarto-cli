import type * as fs from "../deno_ral/fs.ts";
import type { DirEntry } from "../deno_ral/fs.ts";

export function isDir(info: fs.FileInfo, entry: DirEntry): boolean {
  return info.isDirectory && entry.isDirectory;
}
