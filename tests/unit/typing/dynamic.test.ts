/*
* dynamic.test.ts
*
* Copyright (C) 2024 Posit Software, PBC
*
*/

import { checkStringEnum } from "../../../src/typing/dynamic.ts";
import { unitTest } from "../../test.ts";
import { assert, assertThrows } from "testing/asserts";

// deno-lint-ignore require-await
unitTest("checkStringEnum", async () => {
  const check = checkStringEnum("a", "b", "c");
  assert(check("a") === "a");
  assert(check("b") === "b");
  assert(check("c") === "c");
  assertThrows(() => check("d"), Error, "Invalid value 'd' (valid values are a, b, c).");
});