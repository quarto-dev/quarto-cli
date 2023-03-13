// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

/**
 * {@linkcode parse} and {@linkcode stringify} for handling
 * [YAML](https://yaml.org/) encoded data.
 *
 * Ported from
 * [js-yaml v3.13.1](https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da)
 *
 * If your YAML contains multiple documents in it, you can use {@linkcode parseAll} for
 * handling it.
 *
 * To handle `regexp`, and `undefined` types, use {@linkcode EXTENDED_SCHEMA}.
 * You can also use custom types by extending schemas.
 *
 * ## :warning: Limitations
 * - `binary` type is currently not stable.
 *
 * For further examples see https://github.com/nodeca/js-yaml/tree/master/examples.
 * @example
 * ```ts
 * import {
 *   parse,
 *   stringify,
 * } from "https://deno.land/std@$STD_VERSION/encoding/yaml.ts";
 *
 * const data = parse(`
 * foo: bar
 * baz:
 *   - qux
 *   - quux
 * `);
 * console.log(data);
 * // => { foo: "bar", baz: [ "qux", "quux" ] }
 *
 * const yaml = stringify({ foo: "bar", baz: ["qux", "quux"] });
 * console.log(yaml);
 * // =>
 * // foo: bar
 * // baz:
 * //   - qux
 * //   - quux
 * ```
 *
 * @module
 */

export type { ParseOptions } from "./_yaml/parse.ts";
export { parse, parseAll } from "./_yaml/parse.ts";
export type { DumpOptions as StringifyOptions } from "./_yaml/stringify.ts";
export { stringify } from "./_yaml/stringify.ts";
export type { SchemaDefinition } from "./_yaml/schema.ts";
export { Type } from "./_yaml/type.ts";
export type { KindType, RepresentFn, StyleVariant } from "./_yaml/type.ts";
export {
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  EXTENDED_SCHEMA,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
} from "./_yaml/schema/mod.ts";
