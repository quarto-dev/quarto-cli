/*
 * function-times.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { Stats } from "./stats.ts";

export const functionTimes: Record<string, Stats> = {};

// deno-lint-ignore no-explicit-any
export const makeTimedFunction = <T extends (...args: any[]) => any>(
  name: string,
  fn: T,
): T => {
  if (Deno.env.get("QUARTO_REPORT_PERFORMANCE_METRICS") === undefined) {
    return fn;
  }
  if (!functionTimes[name]) {
    functionTimes[name] = new Stats();
  }
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

export const timeCall = <T>(callback: () => T): { result: T; time: number } => {
  const start = performance.now();
  const result = callback();
  const end = performance.now();
  return { result, time: end - start };
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
  if (!functionTimes[name]) {
    functionTimes[name] = new Stats();
  }
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
