// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
/**
 * Provides user-friendly {@linkcode serve} on top of Deno's native HTTP server
 * and other utilities for creating HTTP servers and clients.
 *
 * ## Server
 *
 * Server APIs utilizing Deno's
 * [HTTP server APIs](https://deno.land/manual/runtime/http_server_apis#http-server-apis).
 *
 * ```ts
 * import { serve } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 *
 * serve(() => new Response("Hello World\n"));
 *
 * console.log("http://localhost:8000/");
 * ```
 *
 * ## File Server
 *
 * A small program for serving local files over HTTP.
 *
 * ```sh
 * deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts
 * > HTTP server listening on http://localhost:4507/
 * ```
 *
 * ## HTTP Status Code and Status Text
 *
 * Helper for processing status code and status text.
 *
 * ## HTTP errors
 *
 * Provides error classes for each HTTP error status code as well as utility
 * functions for handling HTTP errors in a structured way.
 *
 * ## Negotiation
 *
 * A set of functions which can be used to negotiate content types, encodings and
 * languages when responding to requests.
 *
 * > Note: some libraries include accept charset functionality by analyzing the
 * > `Accept-Charset` header. This is a legacy header that
 * > [clients omit and servers should ignore](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Charset)
 * > therefore is not provided.
 *
 * ## Cookie maps
 *
 * An alternative to `cookie.ts` is `cookie_map.ts` which provides `CookieMap`,
 * `SecureCookieMap`, and `mergeHeaders` to manage request and response cookies
 * with the familiar `Map` interface.
 *
 * @module
 */

export * from "./cookie.ts";
export * from "./cookie_map.ts";
export * from "./etag.ts";
export * from "./http_errors.ts";
export * from "./http_status.ts";
export * from "./negotiation.ts";
export * from "./server.ts";
export * from "./server_sent_event.ts";
