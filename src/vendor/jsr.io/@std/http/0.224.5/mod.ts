// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
/**
 * Provides user-friendly {@linkcode serve} on top of Deno's native HTTP server
 * and other utilities for creating HTTP servers and clients.
 *
 * ## File Server
 *
 * A small program for serving local files over HTTP.
 *
 * ```sh
 * deno run --allow-net --allow-read --allow-sys jsr:@std/http/file-server
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
 * ## Methods
 *
 * Provides helper functions and types to work with HTTP method strings safely.
 *
 * ## Negotiation
 *
 * A set of functions which can be used to negotiate content types, encodings and
 * languages when responding to requests.
 *
 * > Note: some libraries include accept charset functionality by analyzing the
 * > `Accept-Charset` header. This is a legacy header that
 * > {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Charset | clients omit and servers should ignore}
 * > therefore is not provided.
 *
 * ## Cookie maps
 *
 * An alternative to `cookie.ts` is `cookie_map.ts` which provides `CookieMap`,
 * `SecureCookieMap`, and `mergeHeaders` to manage request and response cookies
 * with the familiar `Map` interface.
 *
 * ## User agent handling
 *
 * The {@linkcode UserAgent} class provides user agent string parsing, allowing
 * a user agent flag to be semantically understood.
 *
 * For example to integrate the user agent provided in the header `User-Agent`
 * in an http request would look like this:
 *
 * ```ts no-eval
 * import { UserAgent } from "@std/http/user-agent";
 *
 * Deno.serve((req) => {
 *   const userAgent = new UserAgent(req.headers.get("user-agent") ?? "");
 *   return new Response(`Hello, ${userAgent.browser.name}
 *     on ${userAgent.os.name} ${userAgent.os.version}!`);
 * });
 * ```
 *
 * @module
 */

export * from "./cookie.ts";
export * from "./etag.ts";
export * from "./status.ts";
export * from "./negotiation.ts";
export * from "./server.ts";
export * from "./unstable_signed_cookie.ts";
export * from "./server_sent_event_stream.ts";
export * from "./user_agent.ts";
export * from "./file_server.ts";
