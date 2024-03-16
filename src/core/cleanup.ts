/*
* cleanup.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { info } from "../deno_ral/log.ts";

const cleanupHandlers: VoidFunction[] = [];

export function onCleanup(handler: VoidFunction) {
  cleanupHandlers.push(handler);
}

export function exitWithCleanup(code: number) {
  for (const handler of cleanupHandlers) {
    try {
      handler();
    } catch (error) {
      info("Error occurred during cleanup: " + error);
    }
  }
  Deno.exit(code);
}
