// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { parseMediaType } from "./parse_media_type.ts";
import { getCharset } from "./get_charset.ts";
import { formatMediaType } from "./format_media_type.ts";
import type { db } from "./_db.ts";
import { typeByExtension } from "./type_by_extension.ts";

/** MIME-types database. */
export type DB = typeof db;
/** Maps content types to their corresponding file extensions. */
export type ContentTypeToExtension = {
  /**
   * Maps each content type key to its corresponding file extension.
   */
  [K in keyof DB]: DB[K] extends { "extensions": readonly string[] }
    ? DB[K]["extensions"][number]
    : never;
};

/** Known extension or type. Used in {@linkcode contentType}. */
export type KnownExtensionOrType =
  | keyof ContentTypeToExtension
  | ContentTypeToExtension[keyof ContentTypeToExtension]
  | `.${ContentTypeToExtension[keyof ContentTypeToExtension]}`;

/**
 * Returns the full `Content-Type` or `Content-Disposition` header value for the
 * given extension or media type.
 *
 * The function will treat the `extensionOrType` as a media type when it
 * contains a `/`, otherwise it will process it as an extension, with or without
 * the leading `.`.
 *
 * Returns `undefined` if unable to resolve the media type.
 *
 * @typeParam T Type of the extension or media type to resolve.
 *
 * @param extensionOrType The extension or media type to resolve.
 *
 * @returns The full `Content-Type` or `Content-Disposition` header value, or
 * `undefined` if unable to resolve the media type.
 *
 * @example Usage
 * ```ts
 * import { contentType } from "@std/media-types/content-type";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(contentType(".json"), "application/json; charset=UTF-8");
 * assertEquals(contentType("text/html"), "text/html; charset=UTF-8");
 * assertEquals(contentType("text/html; charset=UTF-8"), "text/html; charset=UTF-8");
 * assertEquals(contentType("txt"), "text/plain; charset=UTF-8");
 * assertEquals(contentType("foo"), undefined);
 * assertEquals(contentType("file.json"), undefined);
 * ```
 */
export function contentType<
  // Workaround to autocomplete for parameters: https://github.com/microsoft/TypeScript/issues/29729#issuecomment-567871939
  // deno-lint-ignore ban-types
  T extends (string & {}) | KnownExtensionOrType,
>(
  extensionOrType: T,
): Lowercase<T> extends KnownExtensionOrType ? string : string | undefined {
  try {
    const [mediaType, params = {}] = extensionOrType.includes("/")
      ? parseMediaType(extensionOrType)
      : [typeByExtension(extensionOrType), undefined];
    if (!mediaType) {
      return undefined as Lowercase<T> extends KnownExtensionOrType ? string
        : string | undefined;
    }
    if (!("charset" in params)) {
      const charset = getCharset(mediaType);
      if (charset) {
        params.charset = charset;
      }
    }
    return formatMediaType(mediaType, params);
  } catch {
    // just swallow returning undefined
  }
  return undefined as Lowercase<T> extends KnownExtensionOrType ? string
    : string | undefined;
}
