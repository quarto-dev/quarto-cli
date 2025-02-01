// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

// This `reason` comes from `AbortSignal` thus must be `any`.
// deno-lint-ignore no-explicit-any
export function createAbortError(reason?: any): DOMException {
  return new DOMException(
    reason ? `Aborted: ${reason}` : "Aborted",
    "AbortError",
  );
}

export function exponentialBackoffWithJitter(
  cap: number,
  base: number,
  attempt: number,
  multiplier: number,
  jitter: number,
) {
  const exp = Math.min(cap, base * multiplier ** attempt);
  return (1 - jitter * Math.random()) * exp;
}
