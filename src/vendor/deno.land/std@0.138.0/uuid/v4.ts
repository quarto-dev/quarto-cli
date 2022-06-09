// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate that the passed UUID is an RFC4122 v4 UUID.
 *
 * ```ts
 * import { validate } from "./v4.ts";
 * import { generate as generateV1 } from "./v1.ts";
 *
 * validate(crypto.randomUUID()); // true
 * validate(generateV1() as string); // false
 * validate("this-is-not-a-uuid"); // false
 * ```
 */
export function validate(id: string): boolean {
  return UUID_RE.test(id);
}

/**
 * @deprecated v4 UUID generation is deprecated and will be removed in a future
 * std/uuid release. Use the web standard `globalThis.crypto.randomUUID()`
 * function instead.
 *
 * Generate a RFC4122 v4 UUID (pseudo-random).
 */
export function generate(): string {
  return crypto.randomUUID();
}
