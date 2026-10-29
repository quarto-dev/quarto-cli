import type { FileInfo } from "../deno_ral/fs.ts";
import { statSync } from "../deno_ral/fs.ts";

export function info(path: string): FileInfo {
  return statSync(path);
}
