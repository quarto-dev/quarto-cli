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
  assertEquals(pandocNativeStr('"hello\\\'world"').mappedString().value, '`Str "\\"hello\\\\\'world\\""`{=pandoc-native}');
})

// deno-lint-ignore require-await
unitTest("native-string - delimiter longer than the longest backtick run", async () => {
  assertEquals(pandocNativeStr("a`b``c").mappedString().value, '```Str "a`b``c"```{=pandoc-native}');
  assertEquals(pandocNativeStr("a``b`c").mappedString().value, '```Str "a``b`c"```{=pandoc-native}');
  assertEquals(pandocNativeStr("a`b```c``d").mappedString().value, '````Str "a`b```c``d"````{=pandoc-native}');
})

// deno-lint-ignore require-await
unitTest("native-string - backslashes are kept literally", async () => {
  assertEquals(pandocNativeStr("C:\\x\\y").mappedString().value, '`Str "C:\\\\x\\\\y"`{=pandoc-native}');
  assertEquals(pandocNativeStr("a\\nb").mappedString().value, '`Str "a\\\\nb"`{=pandoc-native}');
  assertEquals(pandocNativeStr('a\\"b').mappedString().value, '`Str "a\\\\\\"b"`{=pandoc-native}');
})
