// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import {
  createExtractor,
  type Extractor,
  type Parser,
} from "./create_extractor.ts";

/**
 * Extracts and parses {@link https://www.json.org/ | JSON } from the metadata
 * of front matter content.
 *
 * @example Extract JSON front matter
 * ```ts
 * import { extract } from "@std/front-matter/json";
 * import { assertEquals } from "@std/assert";
 *
 * const output = `---json
 * {
 *   "title": "Three dashes marks the spot"
 * }
 * ---
 * Hello, world!`;
 * const result = extract(output);
 *
 * assertEquals(result, {
 *   frontMatter: '{\n  "title": "Three dashes marks the spot"\n}',
 *   body: "Hello, world!",
 *   attrs: { title: "Three dashes marks the spot" },
 * });
 * ```
 */
export const extract: Extractor = createExtractor({
  json: JSON.parse as Parser,
});
