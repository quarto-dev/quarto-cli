/*
 * fixture
 */
import { join } from "../deno_ral/path.ts";

export function readIt(dir: string): string {
  const info = Deno.statSync(dir);
  if (!info.isDirectory) {
    throw new Error("not a dir");
  }
  return Deno.readTextFileSync(join(dir, "a.txt"));
}

export function infoOf(path: string): Deno.FileInfo {
  return Deno.lstatSync(path);
}
