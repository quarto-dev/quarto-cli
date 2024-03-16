/*
* case-conversion.test.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/

import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import {
  camelToKebab,
} from "../../../src/core/config.ts";

//https://github.com/quarto-dev/quarto-cli/issues/7358
// deno-lint-ignore require-await
unitTest("case convention - camelToKebab", async () => {
  assert(camelToKebab("fooBar") === "foo-bar", "Invalid camelToKebab conversion");
  assert(camelToKebab("fooBarBaz") === "foo-bar-baz", "Invalid camelToKebab conversion");
  assert(camelToKebab("fragmentInURL") === "fragment-in-url", "Invalid camelToKebab conversion");
  assert(camelToKebab("URLFragment") === "url-fragment", "Invalid camelToKebab conversion");
  assert(camelToKebab("isURLHTMLString") === "is-urlhtml-string", "Invalid camelToKebab conversion");
  assert(camelToKebab("isURLHTML") === "is-urlhtml", "Invalid camelToKebab conversion");
});
