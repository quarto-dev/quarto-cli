/*
 * main.ts
 *
 * Utilities for main() functions (setup, cleanup, etc)
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { initializeLogger, logError, logOptions } from "../../src/core/log.ts";
import { Args } from "flags/mod.ts";
import { parse } from "flags/mod.ts";
import { exitWithCleanup } from "./cleanup.ts";

type Runner = (args: Args) => Promise<unknown>;
export async function mainRunner(runner: Runner) {
  try {
    // Parse the raw args to read globals and initialize logging
    const args = parse(Deno.args);
    await initializeLogger(logOptions(args));

    // install termination signal handlers
    if (Deno.build.os !== "windows") {
      Deno.addSignalListener("SIGINT", abend);
      Deno.addSignalListener("SIGTERM", abend);
    }

    await runner(args);

    // if profiling, wait for 10 seconds before quitting
    if (Deno.env.get("QUARTO_TS_PROFILE") !== undefined) {
      console.log("Program finished. Turn off the Chrome profiler now!");
      console.log("Waiting for 10 seconds ...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    exitWithCleanup(0);
  } catch (e) {
    if (e) {
      logError(e);
    }
  } finally {
    abend();
  }
}

function abend() {
  exitWithCleanup(1);
}
