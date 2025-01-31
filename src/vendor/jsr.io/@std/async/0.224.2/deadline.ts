// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { delay } from "./delay.ts";

/** Options for {@linkcode deadline}. */
export interface DeadlineOptions {
  /** Signal used to abort the deadline. */
  signal?: AbortSignal;
}

/**
 * Error thrown when {@linkcode deadline} times out.
 *
 * @example Usage
 * ```ts no-assert
 * import { DeadlineError } from "@std/async/deadline";
 *
 * const error = new DeadlineError();
 * ```
 */
export class DeadlineError extends Error {
  constructor() {
    super("Deadline");
    this.name = this.constructor.name;
  }
}

/**
 * Create a promise which will be rejected with {@linkcode DeadlineError} when
 * a given delay is exceeded.
 *
 * Note: Prefer to use {@linkcode AbortSignal.timeout} instead for the APIs
 * that accept {@linkcode AbortSignal}.
 *
 * @typeParam T The type of the provided and returned promise.
 * @param p The promise to make rejectable.
 * @param ms Duration in milliseconds for when the promise should time out.
 * @param options Additional options.
 * @returns A promise that will reject if the provided duration runs out before resolving.
 *
 * @example Usage
 * ```ts no-eval
 * import { deadline } from "@std/async/deadline";
 * import { delay } from "@std/async/delay";
 *
 * const delayedPromise = delay(1000);
 * // Below throws `DeadlineError` after 10 ms
 * const result = await deadline(delayedPromise, 10);
 * ```
 */
export function deadline<T>(
  p: Promise<T>,
  ms: number,
  options: DeadlineOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const { signal } = options;
  if (signal?.aborted) {
    return Promise.reject(new DeadlineError());
  }
  signal?.addEventListener("abort", () => controller.abort(signal.reason));
  const d = delay(ms, { signal: controller.signal })
    .catch(() => {}) // Do NOTHING on abort.
    .then(() => Promise.reject(new DeadlineError()));
  return Promise.race([p.finally(() => controller.abort()), d]);
}
