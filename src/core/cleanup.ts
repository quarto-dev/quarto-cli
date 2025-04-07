/*
 * cleanup.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info } from "../deno_ral/log.ts";

const cleanupHandlers: VoidFunction[] = [];

export function onCleanup(handler: VoidFunction) {
  cleanupHandlers.push(handler);
}

export function exitWithCleanup(code: number) {
  // Not using cleanupHandlers.reverse() to not mutate the original array
  for (let i = cleanupHandlers.length - 1; i >= 0; i--) {
    const handler = cleanupHandlers[i];
    try {
      handler();
    } catch (error) {
      info("Error occurred during cleanup: " + error);
    }
  }
  Deno.exit(code);
}
