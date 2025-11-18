/*
 * metrics.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { inputTargetIndexCacheMetrics } from "../../project/target-index-cache-metrics.ts";
import { functionTimes } from "./function-times.ts";
import { Stats } from "./stats.ts";

type FileReadRecord = {
  path: string;
  stack: string[];
};

let fileReads: FileReadRecord[] | undefined = undefined;

export function captureFileReads() {
  fileReads = [];

  const originalReadTextFileSync = Deno.readTextFileSync;

  Deno.readTextFileSync = function (path: string | URL) {
    try {
      throw new Error("File read");
    } catch (e) {
      if (!(e instanceof Error)) throw e;
      const stack = e.stack!.split("\n").slice(2);
      fileReads!.push({ path: String(path), stack });
    }
    return originalReadTextFileSync(path);
  };
}

const metricsObject = {
  inputTargetIndexCache: inputTargetIndexCacheMetrics,
  fileReads,
  functionTimes,
};
export type MetricsKeys = keyof typeof metricsObject;

export function quartoPerformanceMetrics(keys?: MetricsKeys[]) {
  if (!keys) {
    return metricsObject;
  }
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key === "functionTimes") {
      const metricsObjects = metricsObject[key] as Record<string, Stats>;
      const entries = Object.entries(metricsObjects);
      result[key] = Object.fromEntries(
        entries.map(([name, stats]) => [name, stats.report()]),
      );
    } else {
      result[key] = metricsObject[key];
    }
  }
  return result;
}

export function reportPerformanceMetrics(keys?: MetricsKeys[]) {
  const content = JSON.stringify(quartoPerformanceMetrics(keys), null, 2);
  const outFile = Deno.env.get("QUARTO_REPORT_PERFORMANCE_METRICS_FILE");
  if (outFile) {
    Deno.writeTextFileSync(outFile, content);
  } else {
    console.log("---");
    console.log("Performance metrics");
    console.log("Quarto:");
    console.log(content);
  }
}
