// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Provides tools for working with JSONC (JSON with comments). Currently, this
 * module only provides a means of parsing JSONC. JSONC serialization is not
 * yet supported.
 *
 * ```ts
 * import { parse } from "@std/jsonc";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * assertEquals(parse('{"foo": "bar", } // comment'), { foo: "bar" });
 *
 * assertEquals(parse('{"foo": "bar", } /* comment *\/'), { foo: "bar" });
 *
 * assertEquals(
 *   parse('{"foo": "bar" } // comment', { allowTrailingComma: false }),
 *   { foo: "bar" }
 * );
 * ```
 *
 * @module
 */
export * from "./parse.ts";
