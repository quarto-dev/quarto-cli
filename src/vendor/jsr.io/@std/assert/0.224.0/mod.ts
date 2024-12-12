// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** A library of assertion functions.
 * If the assertion is false an `AssertionError` will be thrown which will
 * result in pretty-printed diff of failing assertion.
 *
 * This module is browser compatible, but do not rely on good formatting of
 * values for AssertionError messages in browsers.
 *
 * ```ts
 * import { assert } from "@std/assert/assert";
 *
 * assert("I am truthy"); // Doesn't throw
 * assert(false); // Throws `AssertionError`
 * ```
 *
 * @module
 */

export * from "./assert_almost_equals.ts";
export * from "./assert_array_includes.ts";
export * from "./assert_equals.ts";
export * from "./assert_exists.ts";
export * from "./assert_false.ts";
export * from "./assert_greater_or_equal.ts";
export * from "./assert_greater.ts";
export * from "./assert_instance_of.ts";
export * from "./assert_is_error.ts";
export * from "./assert_less_or_equal.ts";
export * from "./assert_less.ts";
export * from "./assert_match.ts";
export * from "./assert_not_equals.ts";
export * from "./assert_not_instance_of.ts";
export * from "./assert_not_match.ts";
export * from "./assert_not_strict_equals.ts";
export * from "./assert_object_match.ts";
export * from "./assert_rejects.ts";
export * from "./assert_strict_equals.ts";
export * from "./assert_string_includes.ts";
export * from "./assert_throws.ts";
export * from "./assert.ts";
export * from "./assertion_error.ts";
export * from "./equal.ts";
export * from "./fail.ts";
export * from "./unimplemented.ts";
export * from "./unreachable.ts";
