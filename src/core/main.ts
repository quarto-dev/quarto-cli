/*
 * main.ts
 *
 * Utilities for main() functions (setup, cleanup, etc)
 *
 * Copyright (C) 2022-2024 Posit Software, PBC
 */

import { logError } from "./log.ts";
import { exitWithCleanup } from "./cleanup.ts";
import {
  captureFileReads,
  reportPeformanceMetrics,
} from "./performance/metrics.ts";

type Runner = () => Promise<unknown>;
export async function mainRunner(runner: Runner) {
  try {
    // install termination signal handlers
    if (Deno.build.os !== "windows") {
      Deno.addSignalListener("SIGINT", abend);
      Deno.addSignalListener("SIGTERM", abend);
    }

    if (Deno.env.get("QUARTO_REPORT_PERFORMANCE_METRICS") !== undefined) {
      captureFileReads();
    }

    await runner();

    // if profiling, wait for 10 seconds before quitting
    if (Deno.env.get("QUARTO_TS_PROFILE") !== undefined) {
      console.log("Program finished. Turn off the Chrome profiler now!");
      console.log("Waiting for 10 seconds ...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    if (Deno.env.get("QUARTO_REPORT_PERFORMANCE_METRICS") !== undefined) {
      reportPeformanceMetrics();
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
