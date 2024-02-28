// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

/**
 * A library of assertion functions.
 * If the assertion is false an `AssertionError` will be thrown which will
 * result in pretty-printed diff of failing assertion.
 *
 * This module is browser compatible, but do not rely on good formatting of
 * values for AssertionError messages in browsers.
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/mod.ts} instead.
 *
 * @module
 */
import * as asserts from "../assert/mod.ts";

/**
 * Make an assertion that `actual` and `expected` are almost equal numbers
 * through a given tolerance. It can be used to take into account IEEE-754
 * double-precision floating-point representation limitations. If the values
 * are not almost equal then throw.
 *
 * @example
 * ```ts
 * import { assertAlmostEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertAlmostEquals(0.01, 0.02, 0.1); // Doesn't throw
 * assertAlmostEquals(0.01, 0.02); // Throws
 * assertAlmostEquals(0.1 + 0.2, 0.3, 1e-16); // Doesn't throw
 * assertAlmostEquals(0.1 + 0.2, 0.3, 1e-17); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_almost_equals.ts} instead.
 */
export function assertAlmostEquals(
  actual: number,
  expected: number,
  tolerance = 1e-7,
  msg?: string,
) {
  asserts.assertAlmostEquals(actual, expected, tolerance, msg);
}

/**
 * An array-like object (`Array`, `Uint8Array`, `NodeList`, etc.) that is not a string.
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_array_includes.ts} instead.
 */
export type ArrayLikeArg<T> = ArrayLike<T> & object;

/**
 * Make an assertion that `actual` includes the `expected` values. If not then
 * an error will be thrown.
 *
 * Type parameter can be specified to ensure values under comparison have the
 * same type.
 *
 * @example
 * ```ts
 * import { assertArrayIncludes } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertArrayIncludes([1, 2], [2]); // Doesn't throw
 * assertArrayIncludes([1, 2], [3]); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_array_includes.ts} instead.
 */
export function assertArrayIncludes<T>(
  actual: ArrayLikeArg<T>,
  expected: ArrayLikeArg<T>,
  msg?: string,
) {
  asserts.assertArrayIncludes<T>(actual, expected, msg);
}

/**
 * Make an assertion that `actual` and `expected` are equal, deeply. If not
 * deeply equal, then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the
 * same type.
 *
 * @example
 * ```ts
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertEquals("world", "world"); // Doesn't throw
 * assertEquals("hello", "world"); // Throws
 * ```
 *
 * Note: formatter option is experimental and may be removed in the future.
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_equals.ts} instead.
 */
export function assertEquals<T>(
  actual: T,
  expected: T,
  msg?: string,
  options: { formatter?: (value: unknown) => string } = {},
) {
  asserts.assertEquals<T>(actual, expected, msg, options);
}

/**
 * Make an assertion that actual is not null or undefined.
 * If not then throw.
 *
 * @example
 * ```ts
 * import { assertExists } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertExists("something"); // Doesn't throw
 * assertExists(undefined); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_exists.ts} instead.
 */
export function assertExists<T>(
  actual: T,
  msg?: string,
): asserts actual is NonNullable<T> {
  asserts.assertExists<T>(actual, msg);
}

/**
 * Assertion condition for {@linkcode assertFalse}.
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_false.ts} instead.
 */
export type Falsy = false | 0 | 0n | "" | null | undefined;

/**
 * Make an assertion, error will be thrown if `expr` have truthy value.
 *
 * @example
 * ```ts
 * import { assertFalse } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertFalse(false); // Doesn't throw
 * assertFalse(true); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_false.ts} instead.
 */
export function assertFalse(expr: unknown, msg = ""): asserts expr is Falsy {
  asserts.assertFalse(expr, msg);
}

/**
 * Make an assertion that `actual` is greater than or equal to `expected`.
 * If not then throw.
 *
 * @example
 * ```ts
 * import { assertGreaterOrEqual } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertGreaterOrEqual(2, 1); // Doesn't throw
 * assertGreaterOrEqual(1, 1); // Doesn't throw
 * assertGreaterOrEqual(0, 1); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_greater_or_equal.ts} instead.
 */
export function assertGreaterOrEqual<T>(
  actual: T,
  expected: T,
  msg?: string,
) {
  asserts.assertGreaterOrEqual<T>(actual, expected, msg);
}

/**
 * Make an assertion that `actual` is greater than `expected`.
 * If not then throw.
 *
 * @example
 * ```ts
 * import { assertGreater } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertGreater(2, 1); // Doesn't throw
 * assertGreater(1, 1); // Throws
 * assertGreater(0, 1); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_greater.ts} instead.
 */
export function assertGreater<T>(actual: T, expected: T, msg?: string) {
  asserts.assertGreater<T>(actual, expected, msg);
}

/**
 * Any constructor
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_instance_of.ts} instead.
 */
// deno-lint-ignore no-explicit-any
export type AnyConstructor = new (...args: any[]) => any;
/** Gets constructor type
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_instance_of.ts} instead.
 */
export type GetConstructorType<T extends AnyConstructor> = T extends // deno-lint-ignore no-explicit-any
new (...args: any) => infer C ? C
  : never;

/**
 * Make an assertion that `obj` is an instance of `type`.
 * If not then throw.
 *
 * @example
 * ```ts
 * import { assertInstanceOf } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertInstanceOf(new Date(), Date); // Doesn't throw
 * assertInstanceOf(new Date(), Number); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_instance_of.ts} instead.
 */
export function assertInstanceOf<T extends AnyConstructor>(
  actual: unknown,
  expectedType: T,
  msg = "",
): asserts actual is GetConstructorType<T> {
  asserts.assertInstanceOf<T>(actual, expectedType, msg);
}

/**
 * Make an assertion that `error` is an `Error`.
 * If not then an error will be thrown.
 * An error class and a string that should be included in the
 * error message can also be asserted.
 *
 * @example
 * ```ts
 * import { assertIsError } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertIsError(null); // Throws
 * assertIsError(new RangeError("Out of range")); // Doesn't throw
 * assertIsError(new RangeError("Out of range"), SyntaxError); // Throws
 * assertIsError(new RangeError("Out of range"), SyntaxError, "Out of range"); // Doesn't throw
 * assertIsError(new RangeError("Out of range"), SyntaxError, "Within range"); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_is_error.ts} instead.
 */
export function assertIsError<E extends Error = Error>(
  error: unknown,
  // deno-lint-ignore no-explicit-any
  ErrorClass?: new (...args: any[]) => E,
  msgMatches?: string | RegExp,
  msg?: string,
): asserts error is E {
  asserts.assertIsError<E>(error, ErrorClass, msgMatches, msg);
}

/**
 * Make an assertion that `actual` is less than or equal to `expected`.
 * If not then throw.
 *
 * @example
 * ```ts
 * import { assertLessOrEqual } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertLessOrEqual(1, 2); // Doesn't throw
 * assertLessOrEqual(1, 1); // Doesn't throw
 * assertLessOrEqual(1, 0); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_less_or_equal.ts} instead.
 */
export function assertLessOrEqual<T>(
  actual: T,
  expected: T,
  msg?: string,
) {
  asserts.assertLessOrEqual<T>(actual, expected, msg);
}

/**
 * Make an assertion that `actual` is less than `expected`.
 * If not then throw.
 *
 * @example
 * ```ts
 * import { assertLess } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertLess(1, 2); // Doesn't throw
 * assertLess(2, 1); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_less.ts} instead.
 */
export function assertLess<T>(actual: T, expected: T, msg?: string) {
  asserts.assertLess<T>(actual, expected, msg);
}

/**
 * Make an assertion that `actual` match RegExp `expected`. If not
 * then throw.
 *
 * @example
 * ```ts
 * import { assertMatch } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertMatch("Raptor", RegExp(/Raptor/)); // Doesn't throw
 * assertMatch("Denosaurus", RegExp(/Raptor/)); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_match.ts} instead.
 */
export function assertMatch(
  actual: string,
  expected: RegExp,
  msg?: string,
) {
  asserts.assertMatch(actual, expected, msg);
}

/**
 * Make an assertion that `actual` and `expected` are not equal, deeply.
 * If not then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 *
 * @example
 * ```ts
 * import { assertNotEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertNotEquals(1, 2); // Doesn't throw
 * assertNotEquals(1, 1); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_not_equals.ts} instead.
 */
export function assertNotEquals<T>(actual: T, expected: T, msg?: string) {
  asserts.assertNotEquals<T>(actual, expected, msg);
}

/**
 * Make an assertion that `obj` is not an instance of `type`.
 * If so, then throw.
 *
 * @example
 * ```ts
 * import { assertNotInstanceOf } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertNotInstanceOf(new Date(), Number); // Doesn't throw
 * assertNotInstanceOf(new Date(), Date); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_not_instance_of.ts} instead.
 */
export function assertNotInstanceOf<A, T>(
  actual: A,
  // deno-lint-ignore no-explicit-any
  unexpectedType: new (...args: any[]) => T,
  msg?: string,
): asserts actual is Exclude<A, T> {
  asserts.assertNotInstanceOf<A, T>(actual, unexpectedType, msg);
}

/**
 * Make an assertion that `actual` not match RegExp `expected`. If match
 * then throw.
 *
 * @example
 * ```ts
 * import { assertNotMatch } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertNotMatch("Denosaurus", RegExp(/Raptor/)); // Doesn't throw
 * assertNotMatch("Raptor", RegExp(/Raptor/)); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_not_match.ts} instead.
 */
export function assertNotMatch(
  actual: string,
  expected: RegExp,
  msg?: string,
) {
  asserts.assertNotMatch(actual, expected, msg);
}

/**
 * Make an assertion that `actual` and `expected` are not strictly equal.
 * If the values are strictly equal then throw.
 *
 * @example
 * ```ts
 * import { assertNotStrictEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertNotStrictEquals(1, 1); // Doesn't throw
 * assertNotStrictEquals(1, 2); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_not_strict_equals.ts} instead.
 */
export function assertNotStrictEquals<T>(
  actual: T,
  expected: T,
  msg?: string,
) {
  asserts.assertNotStrictEquals(actual, expected, msg);
}

/**
 * Make an assertion that `actual` object is a subset of `expected` object,
 * deeply. If not, then throw.
 *
 * @example
 * ```ts
 * import { assertObjectMatch } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertObjectMatch({ foo: "bar" }, { foo: "bar" }); // Doesn't throw
 * assertObjectMatch({ foo: "bar" }, { foo: "baz" }); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_object_match.ts} instead.
 */
export function assertObjectMatch(
  // deno-lint-ignore no-explicit-any
  actual: Record<PropertyKey, any>,
  expected: Record<PropertyKey, unknown>,
  msg?: string,
) {
  asserts.assertObjectMatch(actual, expected, msg);
}

/**
 * Executes a function which returns a promise, expecting it to reject.
 *
 * @example
 * ```ts
 * import { assertRejects } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * await assertRejects(async () => Promise.reject(new Error())); // Doesn't throw
 * await assertRejects(async () => console.log("Hello world")); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_rejects.ts} instead.
 */
export function assertRejects(
  fn: () => PromiseLike<unknown>,
  msg?: string,
): Promise<unknown>;
/**
 * Executes a function which returns a promise, expecting it to reject.
 * If it does not, then it throws. An error class and a string that should be
 * included in the error message can also be asserted.
 *
 * @example
 * ```ts
 * import { assertRejects } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * await assertRejects(async () => Promise.reject(new Error()), Error); // Doesn't throw
 * await assertRejects(async () => Promise.reject(new Error()), SyntaxError); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_rejects.ts} instead.
 */
export function assertRejects<E extends Error = Error>(
  fn: () => PromiseLike<unknown>,
  // deno-lint-ignore no-explicit-any
  ErrorClass: new (...args: any[]) => E,
  msgIncludes?: string,
  msg?: string,
): Promise<E>;
export async function assertRejects<E extends Error = Error>(
  fn: () => PromiseLike<unknown>,
  errorClassOrMsg?:
    // deno-lint-ignore no-explicit-any
    | (new (...args: any[]) => E)
    | string,
  msgIncludesOrMsg?: string,
  msg?: string,
): Promise<E | Error | unknown> {
  return await asserts.assertRejects<E>(
    fn,
    // deno-lint-ignore no-explicit-any
    errorClassOrMsg as new (...args: any[]) => E, // Cast errorClassOrMsg to the correct type
    msgIncludesOrMsg,
    msg,
  );
}

/**
 * Make an assertion that `actual` and `expected` are strictly equal. If
 * not then throw.
 *
 * @example
 * ```ts
 * import { assertStrictEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * const a = {};
 * const b = a;
 * assertStrictEquals(a, b); // Doesn't throw
 *
 * const c = {};
 * const d = {};
 * assertStrictEquals(c, d); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_strict_equals.ts} instead.
 */
export function assertStrictEquals<T>(
  actual: unknown,
  expected: T,
  msg?: string,
): asserts actual is T {
  asserts.assertStrictEquals<T>(actual, expected, msg);
}

/**
 * Make an assertion that actual includes expected. If not
 * then throw.
 *
 * @example
 * ```ts
 * import { assertStringIncludes } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertStringIncludes("Hello", "ello"); // Doesn't throw
 * assertStringIncludes("Hello", "world"); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_string_includes.ts} instead.
 */
export function assertStringIncludes(
  actual: string,
  expected: string,
  msg?: string,
) {
  asserts.assertStringIncludes(actual, expected, msg);
}

/**
 * Executes a function, expecting it to throw. If it does not, then it
 * throws.
 *
 * @example
 * ```ts
 * import { assertThrows } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertThrows(() => { throw new TypeError("hello world!"); }); // Doesn't throw
 * assertThrows(() => console.log("hello world!")); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_throws.ts} instead.
 */
export function assertThrows(
  fn: () => unknown,
  msg?: string,
): unknown;
/**
 * Executes a function, expecting it to throw. If it does not, then it
 * throws. An error class and a string that should be included in the
 * error message can also be asserted.
 *
 * @example
 * ```ts
 * import { assertThrows } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertThrows(() => { throw new TypeError("hello world!"); }, TypeError); // Doesn't throw
 * assertThrows(() => { throw new TypeError("hello world!"); }, RangeError); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert_throws.ts} instead.
 */
export function assertThrows<E extends Error = Error>(
  fn: () => unknown,
  // deno-lint-ignore no-explicit-any
  ErrorClass: new (...args: any[]) => E,
  msgIncludes?: string,
  msg?: string,
): E;
export function assertThrows<E extends Error = Error>(
  fn: () => unknown,
  errorClassOrMsg?:
    // deno-lint-ignore no-explicit-any
    | (new (...args: any[]) => E)
    | string,
  msgIncludesOrMsg?: string,
  msg?: string,
): E | Error | unknown {
  return asserts.assertThrows<E>(
    fn,
    // deno-lint-ignore no-explicit-any
    errorClassOrMsg as new (...args: any[]) => E, // Cast errorClassOrMsg to the correct type
    msgIncludesOrMsg,
    msg,
  );
}

/**
 * Make an assertion, error will be thrown if `expr` does not have truthy value.
 *
 * @example
 * ```ts
 * import { assert } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assert("hello".includes("ello")); // Doesn't throw
 * assert("hello".includes("world")); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assert.ts} instead.
 */
export function assert(expr: unknown, msg = ""): asserts expr {
  asserts.assert(expr, msg);
}

/**
 * Error thrown when an assertion fails.
 *
 * @example
 * ```ts
 * import { AssertionError } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * throw new AssertionError("Assertion failed");
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/assertion_error.ts} instead.
 */
export class AssertionError extends Error {
  /** Constructs a new instance. */
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

/**
 * Deep equality comparison used in assertions
 * @param c actual value
 * @param d expected value
 *
 * @example
 * ```ts
 * import { equal } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * equal({ foo: "bar" }, { foo: "bar" }); // Returns `true`
 * equal({ foo: "bar" }, { foo: "baz" }); // Returns `false
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/equal.ts} instead.
 */
export function equal(c: unknown, d: unknown): boolean {
  return asserts.equal(c, d);
}

/**
 * Forcefully throws a failed assertion.
 *
 * @example
 * ```ts
 * import { fail } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * fail("Deliberately failed!"); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/fail.ts} instead.
 */
export function fail(msg?: string): never {
  asserts.fail(msg);
}

/**
 * Use this to stub out methods that will throw when invoked.
 *
 * @example
 * ```ts
 * import { unimplemented } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * unimplemented(); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/unimplemented.ts} instead.
 */
export function unimplemented(msg?: string): never {
  asserts.unimplemented(msg);
}

/**
 * Use this to assert unreachable code.
 *
 * @example
 * ```ts
 * import { unreachable } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * unreachable(); // Throws
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Import from {@link https://deno.land/std/assert/unreachable.ts} instead.
 */
export function unreachable(): never {
  asserts.unreachable();
}
