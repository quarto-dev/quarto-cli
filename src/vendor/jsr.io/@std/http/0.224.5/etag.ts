// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Provides functions for dealing with and matching ETags, including
 * {@linkcode calculate} to calculate an etag for a given entity,
 * {@linkcode ifMatch} for validating if an ETag matches against a `If-Match`
 * header and {@linkcode ifNoneMatch} for validating an Etag against an
 * `If-None-Match` header.
 *
 * See further information on the `ETag` header on
 * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag | MDN}.
 *
 * @module
 */

import { encodeBase64 as base64Encode } from "jsr:/@std/encoding@1.0.0-rc.2/base64";

/**
 * Just the part of {@linkcode Deno.FileInfo} that is required to calculate an `ETag`,
 * so partial or user generated file information can be passed.
 */
export interface FileInfo {
  /** The last modification time of the file. This corresponds to the `mtime`
   * field from `stat` on Linux/Mac OS and `ftLastWriteTime` on Windows. This
   * may not be available on all platforms. */
  mtime: Date | null;
  /** The size of the file, in bytes. */
  size: number;
}

/** Represents an entity that can be used for generating an ETag. */
export type Entity = string | Uint8Array | FileInfo;

const encoder = new TextEncoder();

const DEFAULT_ALGORITHM: AlgorithmIdentifier = "SHA-256";

/** Options for {@linkcode calculate}. */
export interface ETagOptions {
  /**
   * A digest algorithm to use to calculate the etag.
   *
   * @default {"SHA-256"}
   */
  algorithm?: AlgorithmIdentifier;

  /** Override the default behavior of calculating the `ETag`, either forcing
   * a tag to be labelled weak or not. */
  weak?: boolean;
}

function isFileInfo(value: unknown): value is FileInfo {
  return Boolean(
    value && typeof value === "object" && "mtime" in value && "size" in value,
  );
}

async function calcEntity(
  entity: string | Uint8Array,
  { algorithm = DEFAULT_ALGORITHM }: ETagOptions,
) {
  // a short circuit for zero length entities
  if (entity.length === 0) {
    return `0-47DEQpj8HBSa+/TImW+5JCeuQeR`;
  }

  if (typeof entity === "string") {
    entity = encoder.encode(entity);
  }

  const hash = base64Encode(await crypto.subtle.digest(algorithm, entity))
    .substring(0, 27);

  return `${entity.length.toString(16)}-${hash}`;
}

async function calcFileInfo(
  fileInfo: FileInfo,
  { algorithm = DEFAULT_ALGORITHM }: ETagOptions,
) {
  if (fileInfo.mtime) {
    const hash = base64Encode(
      await crypto.subtle.digest(
        algorithm,
        encoder.encode(fileInfo.mtime.toJSON()),
      ),
    ).substring(0, 27);
    return `${fileInfo.size.toString(16)}-${hash}`;
  }
}

/**
 * Calculate an ETag for an entity. When the entity is a specific set of data
 * it will be fingerprinted as a "strong" tag, otherwise if it is just file
 * information, it will be calculated as a weak tag.
 *
 * @example Usage
 * ```ts
 * import { calculate } from "@std/http/etag";
 * import { assert } from "@std/assert/assert";
 *
 * const body = "hello deno!";
 *
 * const etag = await calculate(body);
 * assert(etag);
 *
 * const res = new Response(body, { headers: { etag } });
 * ```
 *
 * @param entity The entity to get the ETag for.
 * @param options Various additional options.
 * @returns The calculated ETag.
 */
export async function calculate(
  entity: Entity,
  options: ETagOptions = {},
): Promise<string | undefined> {
  const weak = options.weak ?? isFileInfo(entity);
  const tag =
    await (isFileInfo(entity)
      ? calcFileInfo(entity, options)
      : calcEntity(entity, options));

  return tag ? weak ? `W/"${tag}"` : `"${tag}"` : undefined;
}

/** A helper function that takes the value from the `If-Match` header and a
 * calculated etag for the target. By using strong comparison, return `true` if
 * the values match, otherwise `false`.
 *
 * See MDN's [`If-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match)
 * article for more information on how to use this function.
 *
 * @example Usage
 * ```ts no-eval
 * import {
 *   calculate,
 *   ifMatch,
 * } from "@std/http/etag";
 * import { assert } from "@std/assert/assert"
 *
 * const body = "hello deno!";
 *
 * Deno.serve(async (req) => {
 *   const ifMatchValue = req.headers.get("if-match");
 *   const etag = await calculate(body);
 *   assert(etag);
 *   if (!ifMatchValue || ifMatch(ifMatchValue, etag)) {
 *     return new Response(body, { status: 200, headers: { etag } });
 *   } else {
 *     return new Response(null, { status: 412, statusText: "Precondition Failed"});
 *   }
 * });
 * ```
 *
 * @param value the If-Match header value.
 * @param etag the ETag to check against.
 * @returns whether or not the parameters match.
 */
export function ifMatch(
  value: string | null,
  etag: string | undefined,
): boolean {
  // Weak tags cannot be matched and return false.
  if (!value || !etag || etag.startsWith("W/")) {
    return false;
  }
  if (value.trim() === "*") {
    return true;
  }
  const tags = value.split(/\s*,\s*/);
  return tags.includes(etag);
}

/** A helper function that takes the value from the `If-None-Match` header and
 * a calculated etag for the target entity and returns `false` if the etag for
 * the entity matches the supplied value, otherwise `true`.
 *
 * See MDN's [`If-None-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match)
 * article for more information on how to use this function.
 *
 * @example Usage
 * ```ts no-eval
 * import {
 *   calculate,
 *   ifNoneMatch,
 * } from "@std/http/etag";
 * import { assert } from "@std/assert/assert"
 *
 * const body = "hello deno!";
 *
 * Deno.serve(async (req) => {
 *   const ifNoneMatchValue = req.headers.get("if-none-match");
 *   const etag = await calculate(body);
 *   assert(etag);
 *   if (!ifNoneMatch(ifNoneMatchValue, etag)) {
 *     return new Response(null, { status: 304, headers: { etag } });
 *   } else {
 *     return new Response(body, { status: 200, headers: { etag } });
 *   }
 * });
 * ```
 *
 * @param value the If-None-Match header value.
 * @param etag the ETag to check against.
 * @returns whether or not the parameters do not match.
 */
export function ifNoneMatch(
  value: string | null,
  etag: string | undefined,
): boolean {
  if (!value || !etag) {
    return true;
  }
  if (value.trim() === "*") {
    return false;
  }
  etag = etag.startsWith("W/") ? etag.slice(2) : etag;
  const tags = value.split(/\s*,\s*/).map((tag) =>
    tag.startsWith("W/") ? tag.slice(2) : tag
  );
  return !tags.includes(etag);
}
