// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { parseMediaType } from "./parse_media_type.ts";
import { extensions } from "./_db.ts";

export { extensions };

/**
 * Returns the extensions known to be associated with the media type `type`, or
 * `undefined` if no extensions are found.
 *
 * Extensions are returned without a leading `.`.
 *
 * @param type The media type to get the extensions for.
 *
 * @returns The extensions for the given media type, or `undefined` if no
 * extensions are found.
 *
 * @example
 * ```ts
 * import { extensionsByType } from "@std/media-types/extensions-by-type";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * assertEquals(extensionsByType("application/json"), ["json", "map"]);
 * assertEquals(extensionsByType("text/html; charset=UTF-8"), ["html", "htm", "shtml"]);
 * assertEquals(extensionsByType("application/foo"), undefined);
 * ```
 */
export function extensionsByType(type: string): string[] | undefined {
  try {
    const [mediaType] = parseMediaType(type);
    return extensions.get(mediaType);
  } catch {
    // just swallow errors, returning undefined
  }
}
