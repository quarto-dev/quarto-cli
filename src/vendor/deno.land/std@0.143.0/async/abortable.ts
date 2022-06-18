// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { deferred } from "./deferred.ts";

/** Make Promise or AsyncIterable abortable with the given signal. */
export function abortable<T>(p: Promise<T>, signal: AbortSignal): Promise<T>;
export function abortable<T>(
  p: AsyncIterable<T>,
  signal: AbortSignal,
): AsyncGenerator<T>;
export function abortable<T>(
  p: Promise<T> | AsyncIterable<T>,
  signal: AbortSignal,
): Promise<T> | AsyncIterable<T> {
  if (p instanceof Promise) {
    return abortablePromise(p, signal);
  } else {
    return abortableAsyncIterable(p, signal);
  }
}

/** Make Promise abortable with the given signal. */
export function abortablePromise<T>(
  p: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(createAbortError(signal.reason));
  }
  const waiter = deferred<never>();
  const abort = () => waiter.reject(createAbortError(signal.reason));
  signal.addEventListener("abort", abort, { once: true });
  return Promise.race([
    waiter,
    p.finally(() => {
      signal.removeEventListener("abort", abort);
    }),
  ]);
}

/** Make AsyncIterable abortable with the given signal. */
export async function* abortableAsyncIterable<T>(
  p: AsyncIterable<T>,
  signal: AbortSignal,
): AsyncGenerator<T> {
  if (signal.aborted) {
    throw createAbortError(signal.reason);
  }
  const waiter = deferred<never>();
  const abort = () => waiter.reject(createAbortError(signal.reason));
  signal.addEventListener("abort", abort, { once: true });

  const it = p[Symbol.asyncIterator]();
  while (true) {
    const { done, value } = await Promise.race([waiter, it.next()]);
    if (done) {
      signal.removeEventListener("abort", abort);
      return;
    }
    yield value;
  }
}

// This `reason` comes from `AbortSignal` thus must be `any`.
// deno-lint-ignore no-explicit-any
function createAbortError(reason?: any): DOMException {
  return new DOMException(
    reason ? `Aborted: ${reason}` : "Aborted",
    "AbortError",
  );
}
