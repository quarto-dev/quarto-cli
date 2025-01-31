// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { consumeMediaParam, decode2331Encoding } from "./_util.ts";

const SEMICOLON_REGEXP = /^\s*;\s*$/;
/**
 * Parses the media type and any optional parameters, per
 * {@link https://www.rfc-editor.org/rfc/rfc1521.html | RFC 1521}.
 *
 * Media types are the values in `Content-Type` and `Content-Disposition`
 * headers. On success the function returns a tuple where the first element is
 * the media type and the second element is the optional parameters or
 * `undefined` if there are none.
 *
 * The function will throw if the parsed value is invalid.
 *
 * The returned media type will be normalized to be lower case, and returned
 * params keys will be normalized to lower case, but preserves the casing of
 * the value.
 *
 * @param type The media type to parse.
 *
 * @returns A tuple where the first element is the media type and the second
 * element is the optional parameters or `undefined` if there are none.
 *
 * @example Usage
 * ```ts
 * import { parseMediaType } from "@std/media-types/parse-media-type";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(parseMediaType("application/JSON"), ["application/json", undefined]);
 * assertEquals(parseMediaType("text/html; charset=UTF-8"), ["text/html", { charset: "UTF-8" }]);
 * ```
 */
export function parseMediaType(
  type: string,
): [mediaType: string, params: Record<string, string> | undefined] {
  const [base] = type.split(";") as [string];
  const mediaType = base.toLowerCase().trim();

  const params: Record<string, string> = {};
  // Map of base parameter name -> parameter name -> value
  // for parameters containing a '*' character.
  const continuation = new Map<string, Record<string, string>>();

  type = type.slice(base.length);
  while (type.length) {
    type = type.trimStart();
    if (type.length === 0) {
      break;
    }
    const [key, value, rest] = consumeMediaParam(type);
    if (!key) {
      if (SEMICOLON_REGEXP.test(rest)) {
        // ignore trailing semicolons
        break;
      }
      throw new TypeError(
        `Cannot parse media type: invalid parameter "${type}"`,
      );
    }

    let pmap = params;
    const [baseName, rest2] = key.split("*");
    if (baseName && rest2 !== undefined) {
      if (!continuation.has(baseName)) {
        continuation.set(baseName, {});
      }
      pmap = continuation.get(baseName)!;
    }
    if (key in pmap) {
      throw new TypeError("Cannot parse media type: duplicate key");
    }
    pmap[key] = value;
    type = rest;
  }

  // Stitch together any continuations or things with stars
  // (i.e. RFC 2231 things with stars: "foo*0" or "foo*")
  let str = "";
  for (const [key, pieceMap] of continuation) {
    const singlePartKey = `${key}*`;
    const type = pieceMap[singlePartKey];
    if (type) {
      const decv = decode2331Encoding(type);
      if (decv) {
        params[key] = decv;
      }
      continue;
    }

    str = "";
    let valid = false;
    for (let n = 0;; n++) {
      const simplePart = `${key}*${n}`;
      let type = pieceMap[simplePart];
      if (type) {
        valid = true;
        str += type;
        continue;
      }
      const encodedPart = `${simplePart}*`;
      type = pieceMap[encodedPart];
      if (!type) {
        break;
      }
      valid = true;
      if (n === 0) {
        const decv = decode2331Encoding(type);
        if (decv) {
          str += decv;
        }
      } else {
        const decv = decodeURI(type);
        str += decv;
      }
    }
    if (valid) {
      params[key] = str;
    }
  }

  return [mediaType, Object.keys(params).length ? params : undefined];
}
