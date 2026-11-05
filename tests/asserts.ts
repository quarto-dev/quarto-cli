/*
 * asserts.ts
 *
 * The assertions tests use. Tests import from here, never from
 * "testing/asserts" or "@std/assert" directly, so the assertion library can
 * be swapped in one place (dev-docs/runtime-migration, PR 31).
 * Not "testing/asserts": that module declares its own AssertionError, which
 * its assert() and fail() do not throw.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

export {
  assert,
  assertEquals,
  AssertionError,
  assertMatch,
  assertObjectMatch,
  assertRejects,
  assertStringIncludes,
  assertThrows,
  fail,
} from "@std/assert";
