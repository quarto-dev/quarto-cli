// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { NIL_UUID } from "./constants.ts";

/**
 * Determines whether the UUID is the
 * {@link https://www.rfc-editor.org/rfc/rfc4122#section-4.1.7 | nil UUID}.
 *
 * @param id UUID value.
 *
 * @returns `true` if the UUID is the nil UUID, otherwise `false`.
 *
 * @example Usage
 * ```ts
 * import { isNil } from "@std/uuid";
 * import { assert, assertFalse } from "@std/assert";
 *
 * assert(isNil("00000000-0000-0000-0000-000000000000"));
 * assertFalse(isNil(crypto.randomUUID()));
 * ```
 */
export function isNil(id: string): boolean {
  return id === NIL_UUID;
}

/**
 * Determines whether a string is a valid UUID.
 *
 * @param uuid UUID value.
 *
 * @returns `true` if the string is a valid UUID, otherwise `false`.
 *
 * @example Usage
 * ```ts
 * import { validate } from "@std/uuid";
 * import { assert, assertFalse } from "@std/assert";
 *
 * assert(validate("6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"));
 * assertFalse(validate("not a UUID"));
 * ```
 */
export function validate(uuid: string): boolean {
  return /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i
    .test(
      uuid,
    );
}

/**
 * Detect RFC version of a UUID.
 *
 * @param uuid UUID value.
 *
 * @returns The RFC version of the UUID.
 *
 * @example Usage
 * ```ts
 * import { version } from "@std/uuid";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * assertEquals(version("d9428888-122b-11e1-b85c-61cd3cbb3210"), 1);
 * assertEquals(version("6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"), 4);
 * ```
 */
export function version(uuid: string): number {
  if (!validate(uuid)) {
    throw new TypeError("Invalid UUID");
  }

  return parseInt(uuid[14]!, 16);
}
