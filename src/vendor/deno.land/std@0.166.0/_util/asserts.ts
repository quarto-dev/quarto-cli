// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * All internal non-test code, that is files that do not have `test` or `bench` in the name, must use the assertion functions within `_utils/asserts.ts` and not `testing/asserts.ts`. This is to create a separation of concerns between internal and testing assertions.
 */

export class DenoStdInternalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DenoStdInternalError";
  }
}

/** Make an assertion, if not `true`, then throw. */
export function assert(expr: unknown, msg = ""): asserts expr {
  if (!expr) {
    throw new DenoStdInternalError(msg);
  }
}

/** Use this to assert unreachable code. */
export function unreachable(): never {
  throw new DenoStdInternalError("unreachable");
}
