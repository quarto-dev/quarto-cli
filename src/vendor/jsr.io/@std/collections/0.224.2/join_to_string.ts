// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** Options for {@linkcode joinToString}. */
export type JoinToStringOptions = {
  /**
   * The string to use as a separator between the elements.
   *
   * @default {","}
   */
  separator?: string;
  /**
   * The string to use as a prefix for the resulting string.
   *
   * @default {""}
   */
  prefix?: string;
  /**
   * The string to use as a suffix for the resulting string.
   *
   * @default {""}
   */
  suffix?: string;
  /**
   * The maximum number of elements to append. If the value is negative, all
   * elements will be appended, which is the default.
   *
   * @default {-1}
   */
  limit?: number;
  /**
   * The string to use as a placeholder for the truncated elements.
   *
   * @default {"..."}
   */
  truncated?: string;
};

/**
 * Transforms the elements in the given array to strings using the given
 * selector. Joins the produced strings into one using the given `separator`
 * and applying the given `prefix` and `suffix` to the whole string afterwards.
 *
 * If the array could be huge, you can specify a non-negative value of `limit`,
 * in which case only the first `limit` elements will be appended, followed by
 * the `truncated` string.
 *
 * @template T The type of the elements in the input array.
 *
 * @param array The array to join elements from.
 * @param selector The function to transform elements to strings.
 * @param options The options to configure the joining.
 *
 * @returns The resulting string.
 *
 * @example Usage with options
 * ```ts
 * import { joinToString } from "@std/collections/join-to-string";
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * const users = [
 *   { name: "Kim" },
 *   { name: "Anna" },
 *   { name: "Tim" },
 * ];
 *
 * const message = joinToString(users, (user) => user.name, {
 *   suffix: " are winners",
 *   prefix: "result: ",
 *   separator: " and ",
 *   limit: 1,
 *   truncated: "others",
 * });
 *
 * assertEquals(message, "result: Kim and others are winners");
 * ```
 */
export function joinToString<T>(
  array: Iterable<T>,
  selector: (el: T) => string,
  options: Readonly<JoinToStringOptions> = {},
): string {
  const {
    separator = ",",
    prefix = "",
    suffix = "",
    limit = -1,
    truncated = "...",
  } = options;

  let result = "";

  let index = 0;
  for (const el of array) {
    if (index > 0) {
      result += separator;
    }

    if (limit >= 0 && index >= limit) {
      result += truncated;
      break;
    }

    result += selector(el);
    index++;
  }

  return prefix + result + suffix;
}
