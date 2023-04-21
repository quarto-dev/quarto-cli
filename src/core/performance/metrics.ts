/*
 * metrics.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { inputTargetIndexCacheMetrics } from "../../project/project-index.ts";

export function quartoPerformanceMetrics() {
  return {
    inputTargetIndexCache: inputTargetIndexCacheMetrics,
  };
}

export function reportPeformanceMetrics() {
  console.log("---");
  console.log("Performance metrics");
  console.log("Quarto:");
  console.log(JSON.stringify(quartoPerformanceMetrics(), null, 2));
  console.log();
  // denoMetrics is some kind of fancy object that doesn't respond
  // to a bunch of the normal methods.  So we have to do this
  // the JSON-round-trip way.
  console.log("Deno:");
  const denoMetrics = JSON.parse(JSON.stringify(Deno.metrics() as any));
  denoMetrics.ops = Object.fromEntries(
    Object.entries(denoMetrics.ops).map(
      ([key, opMetrics]: any) => {
        for (const key of Object.keys(opMetrics)) {
          if (opMetrics[key] === 0) {
            delete opMetrics[key];
          }
        }
        return [key, opMetrics];
      },
    ).filter(([_key, opMetrics]: any) => Object.keys(opMetrics).length > 0)
      .map(([key, opMetrics]: any) => {
        if (
          (opMetrics.opsDispatched === opMetrics.opsDispatchedSync &&
            opMetrics.opsDispatched === opMetrics.opsCompleted &&
            opMetrics.opsDispatched === opMetrics.opsCompletedSync) ||
          (opMetrics.opsDispatched === opMetrics.opsDispatchedAsync &&
            opMetrics.opsDispatched === opMetrics.opsCompleted &&
            opMetrics.opsDispatched === opMetrics.opsCompletedAsync)
        ) {
          return [key, opMetrics.opsDispatched];
        } else {
          return [key, opMetrics];
        }
      }),
  );
  console.log(JSON.stringify(denoMetrics, null, 2));
}
