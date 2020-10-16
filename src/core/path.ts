import { existsSync } from "fs/exists.ts";

export function removeIfExists(file: string) {
  if (existsSync(file)) {
    Deno.removeSync(file);
  }
}
