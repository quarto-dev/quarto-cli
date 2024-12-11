// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { load, loadAll } from "./_loader/loader.ts";
import { replaceSchemaNameWithSchemaClass } from "./mod.ts";

/**
 * Options for parsing YAML.
 */
export interface ParseOptions {
  /** Uses legacy mode */
  legacy?: boolean;
  /** The listener */
  // deno-lint-ignore no-explicit-any
  listener?: ((...args: any[]) => void) | null;
  /** string to be used as a file path in error/warning messages. */
  filename?: string;
  /**
   * Specifies a schema to use.
   *
   * Schema class or its name.
   */
  schema?: "core" | "default" | "failsafe" | "json" | "extended" | unknown;
  /** compatibility with JSON.parse behaviour. */
  json?: boolean;
  /** function to call on warning messages. */
  onWarning?(this: null, e?: Error): void;
}

/**
 * Parse `content` as single YAML document, and return it.
 *
 * This function does not support regexps, functions, and undefined by default.
 * This method is safe for parsing untrusted data.
 *
 * @example Usage
 * ```ts
 * import { parse } from "@std/yaml/parse";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const data = parse(`
 * id: 1
 * name: Alice
 * `);
 *
 * assertEquals(data, { id: 1, name: "Alice" });
 * ```
 *
 * @throws {YAMLError} Throws error on invalid YAML.
 * @param content YAML string to parse.
 * @param options Parsing options.
 * @returns Parsed document.
 */
export function parse(content: string, options?: ParseOptions): unknown {
  replaceSchemaNameWithSchemaClass(options);
  // deno-lint-ignore no-explicit-any
  return load(content, options as any);
}

/**
 * Same as `parse()`, but understands multi-document sources.
 * Applies iterator to each document if specified, or returns array of documents.
 *
 * @example Usage
 * ```ts
 * import { parseAll } from "@std/yaml/parse";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * parseAll(`
 * ---
 * id: 1
 * name: Alice
 * ---
 * id: 2
 * name: Bob
 * ---
 * id: 3
 * name: Eve
 * `, (doc: any) => {
 *   assertEquals(typeof doc, "object");
 *   assertEquals(typeof doc.id, "number");
 *   assertEquals(typeof doc.name, "string");
 * });
 * ```
 *
 * @param content YAML string to parse.
 * @param iterator Function to call on each document.
 * @param options Parsing options.
 */
export function parseAll(
  content: string,
  iterator: (doc: unknown) => void,
  options?: ParseOptions,
): void;
/**
 * Same as `parse()`, but understands multi-document sources.
 * Applies iterator to each document if specified, or returns array of documents.
 *
 * @example Usage
 * ```ts
 * import { parseAll } from "@std/yaml/parse";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const data = parseAll(`
 * ---
 * id: 1
 * name: Alice
 * ---
 * id: 2
 * name: Bob
 * ---
 * id: 3
 * name: Eve
 * `);
 * assertEquals(data, [ { id: 1, name: "Alice" }, { id: 2, name: "Bob" }, { id: 3, name: "Eve" }]);
 * ```
 *
 * @param content YAML string to parse.
 * @param options Parsing options.
 * @returns Array of parsed documents.
 */
export function parseAll(content: string, options?: ParseOptions): unknown;
export function parseAll(
  content: string,
  iteratorOrOption?: ((doc: unknown) => void) | ParseOptions,
  options?: ParseOptions,
): unknown {
  if (typeof iteratorOrOption !== "function") {
    replaceSchemaNameWithSchemaClass(iteratorOrOption);
  }
  replaceSchemaNameWithSchemaClass(options);
  // deno-lint-ignore no-explicit-any
  return loadAll(content, iteratorOrOption as any, options as any);
}
