import { type statSync } from "../deno_ral/fs.ts";
import type { lstatSync } from "../deno_ral/fs.ts";

export function sizes(path: string) {
  return [Deno.statSync(path).size, Deno.lstatSync(path).size];
}
