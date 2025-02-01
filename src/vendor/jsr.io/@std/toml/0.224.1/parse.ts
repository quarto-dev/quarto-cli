// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { ParserFactory, Toml } from "./_parser.ts";

/**
 * Parse parses TOML string into an object.
 *
 * @example Decode TOML string
 * ```ts
 * import { parse } from "@std/toml/parse";
 * import { assertEquals } from "@std/assert/assert-equals"
 *
 * const tomlString = `title = "TOML Example"
 * [owner]
 * name = "Alice"
 * bio = "Alice is a programmer."`;
 *
 * const obj = parse(tomlString);
 * assertEquals(obj, { title: "TOML Example", owner: { name: "Alice", bio: "Alice is a programmer." } });
 * ```
 * @param tomlString TOML string to be parsed.
 * @returns The parsed JS object.
 */
export const parse: (tomlString: string) => Record<string, unknown> =
  ParserFactory(Toml);
