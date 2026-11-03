import { existsSync } from "../deno_ral/fs.ts";

export function sizeOf(path: string): number {
  if (!existsSync(path)) {
    return 0;
  }
  return Deno.statSync(path).size;
}
