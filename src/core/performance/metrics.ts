/*
 * metrics.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { inputTargetIndexCacheMetrics } from "../../project/project-index.ts";

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

export function quartoPerformanceMetrics() {
  return {
    inputTargetIndexCache: inputTargetIndexCacheMetrics,
    fileReads,
  };
}

export function reportPeformanceMetrics() {
  console.log("---");
  console.log("Performance metrics");
  console.log("Quarto:");
  console.log(JSON.stringify(quartoPerformanceMetrics(), null, 2));
}
