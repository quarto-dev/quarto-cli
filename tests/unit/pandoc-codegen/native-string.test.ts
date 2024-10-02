/*
* native-string.test.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { pandocNativeStr } from "../../../src/core/pandoc/codegen.ts";

// deno-lint-ignore require-await
unitTest("native-string - basics", async () => {
  assertEquals(pandocNativeStr("hello").mappedString().value, '`Str "hello"`{=pandoc-native}');
  assertEquals(pandocNativeStr('"hello"').mappedString().value, '`Str "\\"hello\\""`{=pandoc-native}');
  assertEquals(pandocNativeStr('"hel`lo"').mappedString().value, '``Str "\\"hel`lo\\""``{=pandoc-native}');
  assertEquals(pandocNativeStr('"hello\nworld"').mappedString().value, '`Str "\\"hello\\nworld\\""`{=pandoc-native}');
  assertEquals(pandocNativeStr('"hello\\\'world"').mappedString().value, '`Str "\\"hello\\\'world\\""`{=pandoc-native}');
})
