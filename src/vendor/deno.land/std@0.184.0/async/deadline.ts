// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { deferred } from "./deferred.ts";

export class DeadlineError extends Error {
  constructor() {
    super("Deadline");
    this.name = "DeadlineError";
  }
}

/**
 * Create a promise which will be rejected with {@linkcode DeadlineError} when a given delay is exceeded.
 *
 * NOTE: Prefer to use `AbortSignal.timeout` instead for the APIs accept `AbortSignal`.
 *
 * @example
 * ```typescript
 * import { deadline } from "https://deno.land/std@$STD_VERSION/async/deadline.ts";
 * import { delay } from "https://deno.land/std@$STD_VERSION/async/delay.ts";
 *
 * const delayedPromise = delay(1000);
 * // Below throws `DeadlineError` after 10 ms
 * const result = await deadline(delayedPromise, 10);
 * ```
 */
export function deadline<T>(p: Promise<T>, delay: number): Promise<T> {
  const d = deferred<never>();
  const t = setTimeout(() => d.reject(new DeadlineError()), delay);
  return Promise.race([p, d]).finally(() => clearTimeout(t));
}
