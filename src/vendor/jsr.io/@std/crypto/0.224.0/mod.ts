// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Extensions to the
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API | Web Crypto}
 * supporting additional encryption APIs, but also delegating to the built-in
 * APIs when possible.
 *
 * ```ts
 * import { crypto } from "@std/crypto/crypto";
 *
 * const message = "Hello, Deno!";
 * const encoder = new TextEncoder();
 * const data = encoder.encode(message);
 *
 * await crypto.subtle.digest("BLAKE3", data);
 * ```
 *
 * @module
 */

export * from "./crypto.ts";
export * from "./unstable_keystack.ts";
export * from "./timing_safe_equal.ts";
