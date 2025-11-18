/*
 * target-index-cache-metrics.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

/**
 * Performance metrics for the input target index cache
 * Tracks cache efficiency for optional performance profiling
 */
export const inputTargetIndexCacheMetrics = {
  hits: 0,
  misses: 0,
  invalidations: 0,
};
