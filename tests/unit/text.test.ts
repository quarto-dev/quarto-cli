/*
* lines.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import { lines } from "../../src/core/text.ts";
import { editDistance } from "../../src/core/lib/text.ts";

// deno-lint-ignore require-await
unitTest("text - lines()", async () => {
  const texts = ["a", "b", "c"];
  const splits = ["\n", "\r\n"];
  splits.forEach((split) => {
    assert(
      lines(texts.join(split)).length === texts.length,
      "Invalid line count",
    );
  });
});

// deno-lint-ignore require-await
unitTest("text - editDistance", async () => {
  assert(editDistance("abc", "abd") === 10);
  assert(editDistance("", "abd") === 30);
  assert(editDistance("abdef", "abd") === 20);
  assert(editDistance("abdef", "") === 50);
  assert(editDistance("abdef", "abcdef") === 10);
  assert(editDistance("abdef", "abcef") === 10);
  assert(editDistance("abcDef", "abc-def") === 2);
  assert(editDistance("abc_def", "abc-def") === 1);
  assert(editDistance("abc_def", "abcDef") === 2);
  assert(editDistance("one-option-2", "one-option-3") === 1);
});
