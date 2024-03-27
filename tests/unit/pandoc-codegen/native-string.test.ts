/*
* native-string.test.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import bounds from "binary-search-bounds";

import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts.ts";
import { pandocNativeStr } from "../../../src/core/pandoc/codegen.ts";

// deno-lint-ignore require-await
unitTest("native-string - basics", async () => {
  assert(pandocNativeStr("hello").mappedString().value === '`Str "hello"`{=pandoc-native}');
  assert(pandocNativeStr('"hello"').mappedString().value === '`Str "\\"hello\\""`{=pandoc-native}');
  assert(pandocNativeStr('"hel`lo"').mappedString().value === '``Str "\\"hel`lo\\""``{=pandoc-native}');
})
