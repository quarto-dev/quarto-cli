/*
* main.ts
*
* Utilities for main() functions (setup, cleanup, etc)
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import {
  cleanupLogger,
  initializeLogger,
  logError,
  logOptions,
} from "../../src/core/log.ts";

import { parse } from "flags/mod.ts";
import { cleanupSessionTempDir } from "./temp.ts";
// import { cleanupEsbuild } from "./esbuild.ts";

// const cleanupHandlers: (() => undefined)[] = [];

// export function addCleanupHandler(handler: () => undefined) {
//   cleanupHandlers.push(handler);
// }

export async function mainRunner(
  runner: (() => Promise<unknown>),
): Promise<unknown> {
  try {
    // install termination signal handlers
    if (Deno.build.os !== "windows") {
      Deno.addSignalListener("SIGINT", abend);
      Deno.addSignalListener("SIGTERM", abend);
    }

    await initializeLogger(logOptions(parse(Deno.args)));

    await runner();

    await cleanupLogger();
    cleanup();

    // exit
    Deno.exit(0);
  } catch (e) {
    if (e) {
      logError(e);
    }
    abend();
  }

  // we never get here because of Deno.exit() on both sides
  // of the try{} clause, but the typescript compiler doesn't
  // like an async function without a return statement
  return undefined;
}

function abend() {
  cleanup();
  Deno.exit(1);
}

function cleanup() {
  cleanupSessionTempDir();
  // cleanupEsbuild();
  // for (const handler of cleanupHandlers) {
  //   handler();
  // }
}
