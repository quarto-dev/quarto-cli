import type { FileInfo } from "../deno_ral/fs.ts";

export function info(path: string): FileInfo {
  return Deno.statSync(path);
}
