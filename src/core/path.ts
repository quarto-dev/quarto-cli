import { basename, dirname, extname } from "path/mod.ts";

import { existsSync } from "fs/exists.ts";

export function removeIfExists(file: string) {
  if (existsSync(file)) {
    Deno.removeSync(file);
  }
}

export function dirAndStem(file: string) {
  return [
    dirname(file),
    basename(file, extname(file)),
  ];
}
