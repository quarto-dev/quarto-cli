// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { dump } from "./_dumper/dumper.ts";
import { replaceSchemaNameWithSchemaClass } from "./mod.ts";

/**
 * The option for strinigfy.
 */
export type DumpOptions = {
  /** Indentation width to use (in spaces). */
  indent?: number;
  /** When true, will not add an indentation level to array elements */
  noArrayIndent?: boolean;
  /**
   * Do not throw on invalid types (like function in the safe schema)
   * and skip pairs and single values with such types.
   */
  skipInvalid?: boolean;
  /**
   * Specifies level of nesting, when to switch from
   * block to flow style for collections. -1 means block style everywhere
   */
  flowLevel?: number;
  /** Each tag may have own set of styles.	- "tag" => "style" map. */
  styles?: Record<string, "lowercase" | "uppercase" | "camelcase" | "decimal">;
  /**
   * Specifies a schema to use.
   *
   * Schema class or its name.
   */
  schema?: "core" | "default" | "failsafe" | "json" | "extended" | unknown;
  /**
   * If true, sort keys when dumping YAML in ascending, ASCII character order.
   * If a function, use the function to sort the keys. (default: false)
   * If a function is specified, the function must return a negative value
   * if first argument is less than second argument, zero if they're equal
   * and a positive value otherwise.
   */
  sortKeys?: boolean | ((a: string, b: string) => number);
  /** Set max line width. (default: 80) */
  lineWidth?: number;
  /**
   * If true, don't convert duplicate objects
   * into references (default: false)
   */
  noRefs?: boolean;
  /**
   * If true don't try to be compatible with older yaml versions.
   * Currently: don't quote "yes", "no" and so on,
   * as required for YAML 1.1 (default: false)
   */
  noCompatMode?: boolean;
  /**
   * If true flow sequences will be condensed, omitting the
   * space between `key: value` or `a, b`. Eg. `'[a,b]'` or `{a:{b:c}}`.
   * Can be useful when using yaml for pretty URL query params
   * as spaces are %-encoded. (default: false).
   */
  condenseFlow?: boolean;
};

/**
 * Serializes `data` as a YAML document.
 *
 * You can disable exceptions by setting the skipInvalid option to true.
 *
 * @example Usage
 * ```ts
 * import { stringify } from "@std/yaml/stringify";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const data = { id: 1, name: "Alice" };
 * const yaml = stringify(data);
 *
 * assertEquals(yaml, "id: 1\nname: Alice\n");
 * ```
 *
 * @param data The data to serialize.
 * @param options The options for serialization.
 * @returns A YAML string.
 */
export function stringify(
  data: unknown,
  options?: DumpOptions,
): string {
  replaceSchemaNameWithSchemaClass(options);
  // deno-lint-ignore no-explicit-any
  return dump(data, options as any);
}
