// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { isIterator, isToken, needsEncoding } from "./_util.ts";

/**
 * Serializes the media type and the optional parameters as a media type
 * conforming to {@link https://www.rfc-editor.org/rfc/rfc2045.html | RFC 2045} and
 * {@link https://www.rfc-editor.org/rfc/rfc2616.html | RFC 2616}.
 *
 * The type and parameter names are written in lower-case.
 *
 * When any of the arguments results in a standard violation then the return
 * value will be an empty string (`""`).
 *
 * @param type The media type to serialize.
 * @param param Optional parameters to serialize.
 *
 * @returns The serialized media type.
 *
 * @example Basic usage
 * ```ts
 * import { formatMediaType } from "@std/media-types/format-media-type";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(formatMediaType("text/plain"), "text/plain");
 * ```
 *
 * @example With parameters
 * ```ts
 * import { formatMediaType } from "@std/media-types/format-media-type";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(formatMediaType("text/plain", { charset: "UTF-8" }), "text/plain; charset=UTF-8");
 * ```
 */
export function formatMediaType(
  type: string,
  param?: Record<string, string> | Iterable<[string, string]>,
): string {
  let serializedMediaType = "";
  const [major = "", sub] = type.split("/");
  if (!sub) {
    if (!isToken(type)) {
      return "";
    }
    serializedMediaType += type.toLowerCase();
  } else {
    if (!isToken(major) || !isToken(sub)) {
      return "";
    }
    serializedMediaType += `${major.toLowerCase()}/${sub.toLowerCase()}`;
  }

  if (param) {
    param = isIterator(param) ? Object.fromEntries(param) : param;
    const attrs = Object.keys(param);
    attrs.sort();

    for (const attribute of attrs) {
      if (!isToken(attribute)) {
        return "";
      }
      const value = param[attribute]!;
      serializedMediaType += `; ${attribute.toLowerCase()}`;

      const needEnc = needsEncoding(value);
      if (needEnc) {
        serializedMediaType += "*";
      }
      serializedMediaType += "=";

      if (needEnc) {
        serializedMediaType += `utf-8''${encodeURIComponent(value)}`;
        continue;
      }

      if (isToken(value)) {
        serializedMediaType += value;
        continue;
      }
      serializedMediaType += `"${value.replace(/["\\]/gi, (m) => `\\${m}`)}"`;
    }
  }
  return serializedMediaType;
}
