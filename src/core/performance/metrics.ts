/*
 * metrics.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { inputTargetIndexCacheMetrics } from "../../project/project-index.ts";
import { Stats } from "./stats.ts";

type FileReadRecord = {
  path: string;
  stack: string;
};

let fileReads: FileReadRecord[] | undefined = undefined;

export function captureFileReads() {
  fileReads = [];

  const originalReadTextFileSync = Deno.readTextFileSync;

  Deno.readTextFileSync = function (path: string | URL) {
    try {
      throw new Error("File read");
    } catch (e) {
      const stack = e.stack!.split("\n").slice(2);
      fileReads!.push({ path: String(path), stack });
    }
    return originalReadTextFileSync(path);
  };
}

const functionTimes: Record<string, Stats> = {};
// deno-lint-ignore no-explicit-any
export const makeTimedFunction = <T extends (...args: any[]) => any>(
  name: string,
  fn: T,
): T => {
  if (Deno.env.get("QUARTO_REPORT_PERFORMANCE_METRICS") === undefined) {
    return fn;
  }
  functionTimes[name] = new Stats();
  return function (...args: Parameters<T>): ReturnType<T> {
    const start = performance.now();
    try {
      const result = fn(...args);
      return result;
    } finally {
      const end = performance.now();
      functionTimes[name].add(end - start);
    }
  } as T;
};

export const makeTimedFunctionAsync = <
  // deno-lint-ignore no-explicit-any
  T extends (...args: any[]) => Promise<any>,
>(
  name: string,
  fn: T,
): T => {
  if (Deno.env.get("QUARTO_REPORT_PERFORMANCE_METRICS") === undefined) {
    return fn;
  }
  functionTimes[name] = new Stats();
  return async function (...args: Parameters<T>): Promise<ReturnType<T>> {
    const start = performance.now();
    try {
      const result = await fn(...args);
      return result;
    } finally {
      const end = performance.now();
      functionTimes[name].add(end - start);
    }
  } as T;
};

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
  console.log("---");
  console.log("Performance metrics");
  console.log("Quarto:");
  const content = JSON.stringify(quartoPerformanceMetrics(keys), null, 2);
  const outFile = Deno.env.get("QUARTO_REPORT_PERFORMANCE_METRICS_FILE");
  if (outFile) {
    Deno.writeTextFileSync(outFile, content);
  } else {
    console.log(content);
  }
}
