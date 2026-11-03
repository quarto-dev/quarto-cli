import type * as fs from "../deno_ral/fs.ts";

export function isDir(info: fs.FileInfo, entry: Deno.DirEntry): boolean {
  return info.isDirectory && entry.isDirectory;
}
