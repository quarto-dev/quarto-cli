import { join } from "../deno_ral/path.ts";
import { readTextFileSync } from "../deno_ral/fs.ts";

function remove(path: string) {
  return Deno.remove(path);
}

export function readIt(dir: string): string {
  remove(dir);
  return readTextFileSync(join(dir, "a.txt"));
}
