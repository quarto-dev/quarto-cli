/*
* log.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function logError(msg: string) {
  Deno.stderr.writeSync(new TextEncoder().encode(msg + "\n"));
}
