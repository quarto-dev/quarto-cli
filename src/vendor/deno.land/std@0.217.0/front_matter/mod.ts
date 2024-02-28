// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Copyright (c) Jason Campbell. MIT license

/**
 * Extracts
 * {@link https://daily-dev-tips.com/posts/what-exactly-is-frontmatter/ | front matter}
 * from strings.
 *
 * {@linkcode createExtractor} and {@linkcode test} functions
 * to handle many forms of front matter.
 *
 * Adapted from
 * {@link https://github.com/jxson/front-matter/blob/36f139ef797bd9e5196a9ede03ef481d7fbca18e/index.js | jxson/front-matter}.
 *
 * Supported formats:
 *
 * - [`YAML`](./front_matter/yaml.ts)
 * - [`TOML`](./front_matter/toml.ts)
 * - [`JSON`](./front_matter/json.ts)
 *
 * ### Basic usage
 *
 * example.md
 *
 * ```markdown
 * ---
 * module: front_matter
 * tags:
 *   - yaml
 *   - toml
 *   - json
 * ---
 *
 * deno is awesome
 * ```
 *
 * example.ts
 *
 * ```ts
 * import { extract } from "https://deno.land/std@$STD_VERSION/front_matter/any.ts";
 * import { test } from "https://deno.land/std@$STD_VERSION/front_matter/test.ts";
 *
 * const str = await Deno.readTextFile("./example.md");
 *
 * if (test(str)) {
 *   console.log(extract(str));
 * } else {
 *   console.log("document doesn't contain front matter");
 * }
 * ```
 *
 * ```sh
 * $ deno run ./example.ts
 * {
 *   frontMatter: "module: front_matter\ntags:\n  - yaml\n  - toml\n  - json",
 *   body: "deno is awesome",
 *   attrs: { module: "front_matter", tags: [ "yaml", "toml", "json" ] }
 * }
 * ```
 *
 * The above example recognizes any of the supported formats, extracts metadata and
 * parses accordingly. Please note that in this case both the [YAML](#yaml) and
 * [TOML](#toml) parsers will be imported as dependencies.
 *
 * If you need only one specific format then you can import the file named
 * respectively from [here](./front_matter).
 *
 * ### Advanced usage
 *
 * ```ts
 * import { test as _test } from "https://deno.land/std@$STD_VERSION/front_matter/test.ts";
 * import {
 *   createExtractor,
 *   Parser,
 * } from "https://deno.land/std@$STD_VERSION/front_matter/mod.ts";
 * import { parse } from "https://deno.land/std@$STD_VERSION/toml/parse.ts";
 *
 * const extract = createExtractor({
 *   "toml": parse as Parser,
 *   "json": JSON.parse as Parser,
 * });
 *
 * export function test(str: string): boolean {
 *   return _test(str, ["toml", "json"]);
 * }
 * ```
 *
 * In this setup `extract()` and `test()` will work with TOML and JSON and only.
 * This way the YAML parser is not loaded if not needed. You can cherry-pick which
 * combination of formats are you supporting based on your needs.
 *
 * ### Delimiters
 *
 * #### YAML
 *
 * ```markdown
 * ---
 * these: are
 * ---
 * ```
 *
 * ```markdown
 * ---yaml
 * all: recognized
 * ---
 * ```
 *
 * ```markdown
 * = yaml =
 * as: yaml
 * = yaml =
 * ```
 *
 * #### TOML
 *
 * ```markdown
 * ---toml
 * this = 'is'
 * ---
 * ```
 *
 * ```markdown
 * = toml =
 * parsed = 'as'
 * toml = 'data'
 * = toml =
 * ```
 *
 * ```markdown
 * +++
 * is = 'that'
 * not = 'cool?'
 * +++
 * ```
 *
 * #### JSON
 *
 * ```markdown
 * ---json
 * {
 *   "and": "this"
 * }
 * ---
 * ```
 *
 * ```markdown
 * {
 *   "is": "JSON"
 * }
 * ```
 *
 * @module
 */

export * from "./create_extractor.ts";
export * from "./test.ts";
