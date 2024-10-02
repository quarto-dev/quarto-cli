// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Determines whether a string is a valid
 * {@link https://www.rfc-editor.org/rfc/rfc9562.html#section-5.4 | UUIDv4}.
 *
 * @param id UUID value.
 *
 * @returns `true` if the UUID is valid UUIDv4, otherwise `false`.
 *
 * @example Usage
 * ```ts
 * import { validate } from "@std/uuid/v4";
 * import { assert, assertFalse } from "@std/assert";
 *
 * assert(validate(crypto.randomUUID()));
 * assertFalse(validate("this-is-not-a-uuid"));
 * ```
 */
export function validate(
  id: string,
): id is ReturnType<typeof crypto.randomUUID> {
  return UUID_RE.test(id);
}
