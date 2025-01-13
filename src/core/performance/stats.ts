/*
 * stats.ts
 *
 * Capture some sufficient statistics for performance analysis
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

export class Stats {
  // let's use Welford's algorithm for online variance calculation
  count: number;
  mean: number;
  m2: number;

  min: number;
  max: number;

  constructor() {
    this.count = 0;
    this.mean = 0;
    this.m2 = 0;
    this.min = Number.MAX_VALUE;
    this.max = -Number.MAX_VALUE;
  }

  add(x: number) {
    this.count++;
    const delta = x - this.mean;
    this.mean += delta / this.count;
    const delta2 = x - this.mean;
    this.m2 += delta * delta2;
    this.min = Math.min(this.min, x);
    this.max = Math.max(this.max, x);
  }

  report() {
    if (this.count === 0) {
      return {
        count: 0,
        total: 0,
      };
    }
    return {
      min: this.min,
      max: this.max,
      count: this.count,
      mean: this.mean,
      variance: this.m2 / this.count,
      total: this.mean * this.count,
    };
  }
}
