// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { extensionsByType } from "./extensions_by_type.ts";

/**
 * Returns the most relevant extension for the given media type, or `undefined`
 * if no extension can be found.
 *
 * Extensions are returned without a leading `.`.
 *
 * @param type The media type to get the extension for.
 *
 * @returns The extension for the given media type, or `undefined` if no
 * extension is found.
 *
 * @example Usage
 * ```ts
 * import { extension } from "@std/media-types/extension";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * assertEquals(extension("text/plain"), "txt");
 * assertEquals(extension("application/json"), "json");
 * assertEquals(extension("text/html; charset=UTF-8"), "html");
 * assertEquals(extension("application/foo"), undefined);
 * ```
 */
export function extension(type: string): string | undefined {
  return extensionsByType(type)?.[0];
}
