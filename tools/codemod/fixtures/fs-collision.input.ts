import { join } from "../deno_ral/path.ts";

function remove(path: string) {
  return Deno.remove(path);
}

export function readIt(dir: string): string {
  remove(dir);
  return Deno.readTextFileSync(join(dir, "a.txt"));
}
