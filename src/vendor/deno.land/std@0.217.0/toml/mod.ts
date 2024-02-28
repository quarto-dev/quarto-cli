// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * {@linkcode parse} and {@linkcode stringify} for handling
 * {@link https://toml.io/en/latest | TOML} encoded data. Be sure to read the supported
 * types as not every spec is supported at the moment and the handling in
 * TypeScript side is a bit different.
 *
 * ## Supported types and handling
 *
 * - [x] [Keys](https://toml.io/en/latest#keys)
 * - [ ] [String](https://toml.io/en/latest#string)
 * - [x] [Multiline String](https://toml.io/en/latest#string)
 * - [x] [Literal String](https://toml.io/en/latest#string)
 * - [ ] [Integer](https://toml.io/en/latest#integer)
 * - [x] [Float](https://toml.io/en/latest#float)
 * - [x] [Boolean](https://toml.io/en/latest#boolean)
 * - [x] [Offset Date-time](https://toml.io/en/latest#offset-date-time)
 * - [x] [Local Date-time](https://toml.io/en/latest#local-date-time)
 * - [x] [Local Date](https://toml.io/en/latest#local-date)
 * - [ ] [Local Time](https://toml.io/en/latest#local-time)
 * - [x] [Table](https://toml.io/en/latest#table)
 * - [x] [Inline Table](https://toml.io/en/latest#inline-table)
 * - [ ] [Array of Tables](https://toml.io/en/latest#array-of-tables)
 *
 * _Supported with warnings see [Warning](#Warning)._
 *
 * ### Warning
 *
 * #### String
 *
 * - Regex: Due to the spec, there is no flag to detect regex properly in a TOML
 *   declaration. So the regex is stored as string.
 *
 * #### Integer
 *
 * For **Binary** / **Octal** / **Hexadecimal** numbers, they are stored as string
 * to be not interpreted as Decimal.
 *
 * #### Local Time
 *
 * Because local time does not exist in JavaScript, the local time is stored as a
 * string.
 *
 * #### Inline Table
 *
 * Inline tables are supported. See below:
 *
 * ```toml
 * animal = { type = { name = "pug" } }
 * ## Output { animal: { type: { name: "pug" } } }
 * animal = { type.name = "pug" }
 * ## Output { animal: { type : { name : "pug" } }
 * animal.as.leaders = "tosin"
 * ## Output { animal: { as: { leaders: "tosin" } } }
 * "tosin.abasi" = "guitarist"
 * ## Output { tosin.abasi: "guitarist" }
 * ```
 *
 * #### Array of Tables
 *
 * At the moment only simple declarations like below are supported:
 *
 * ```toml
 * [[bin]]
 * name = "deno"
 * path = "cli/main.rs"
 *
 * [[bin]]
 * name = "deno_core"
 * path = "src/foo.rs"
 *
 * [[nib]]
 * name = "node"
 * path = "not_found"
 * ```
 *
 * will output:
 *
 * ```json
 * {
 *   "bin": [
 *     { "name": "deno", "path": "cli/main.rs" },
 *     { "name": "deno_core", "path": "src/foo.rs" }
 *   ],
 *   "nib": [{ "name": "node", "path": "not_found" }]
 * }
 * ```
 *
 * This module is browser compatible.
 *
 * @example
 * ```ts
 * import {
 *   parse,
 *   stringify,
 * } from "https://deno.land/std@$STD_VERSION/toml/mod.ts";
 * const obj = {
 *   bin: [
 *     { name: "deno", path: "cli/main.rs" },
 *     { name: "deno_core", path: "src/foo.rs" },
 *   ],
 *   nib: [{ name: "node", path: "not_found" }],
 * };
 * const tomlString = stringify(obj);
 * console.log(tomlString);
 *
 * // =>
 * // [[bin]]
 * // name = "deno"
 * // path = "cli/main.rs"
 *
 * // [[bin]]
 * // name = "deno_core"
 * // path = "src/foo.rs"
 *
 * // [[nib]]
 * // name = "node"
 * // path = "not_found"
 *
 * const tomlObject = parse(tomlString);
 * console.log(tomlObject);
 *
 * // =>
 * // {
 * //   bin: [
 * //     { name: "deno", path: "cli/main.rs" },
 * //     { name: "deno_core", path: "src/foo.rs" }
 * //   ],
 * //   nib: [ { name: "node", path: "not_found" } ]
 * // }
 * ```
 *
 * @module
 */

export * from "./stringify.ts";
export * from "./parse.ts";
