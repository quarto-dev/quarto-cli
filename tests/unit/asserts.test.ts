/*
 * asserts.test.ts
 *
 * tests/asserts.ts is the one module tests import assertions from (so the
 * assertion library can be swapped in one place when the tests run on Node).
 * This pins the exported names and that they behave like @std/assert.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import {
  assert,
  assertEquals,
  AssertionError,
  assertMatch,
  assertObjectMatch,
  assertRejects,
  assertStringIncludes,
  assertThrows,
  fail,
} from "../asserts.ts";

// deno-lint-ignore require-await
unitTest("asserts - passing assertions return normally", async () => {
  assert(true);
  assertEquals({ a: [1, 2] }, { a: [1, 2] });
  assertMatch("quarto 1.11", /\d+\.\d+/);
  assertObjectMatch({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 2 } });
  assertStringIncludes("render html", "html");
});

unitTest("asserts - failing assertions throw AssertionError", async () => {
  assertThrows(() => assert(false), AssertionError);
  assertThrows(() => assertEquals(1, 2), AssertionError);
  assertThrows(() => fail("boom"), AssertionError, "boom");
  await assertRejects(() => Promise.reject(new TypeError("x")), TypeError, "x");
});
