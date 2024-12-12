// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Pure functions for common tasks around collection types like arrays and
 * objects.
 *
 * Heavily inspired by
 * {@link https://kotlinlang.org/api/latest/jvm/stdlib/kotlin.collections/ | Kotlin's Collections}
 * package.
 *
 * ```ts
 * import { intersect, sample, pick } from "@std/collections";
 * import { assertEquals, assertArrayIncludes } from "@std/assert";
 *
 * const lisaInterests = ["Cooking", "Music", "Hiking"];
 * const kimInterests = ["Music", "Tennis", "Cooking"];
 *
 * assertEquals(intersect(lisaInterests, kimInterests), ["Cooking", "Music"]);
 *
 * assertArrayIncludes(lisaInterests, [sample(lisaInterests)]);
 *
 * const cat = { name: "Lulu", age: 3, breed: "Ragdoll" };
 *
 * assertEquals(pick(cat, ["name", "breed"]), { name: "Lulu", breed: "Ragdoll"});
 * ```
 *
 * @module
 */

export * from "./aggregate_groups.ts";
export * from "./associate_by.ts";
export * from "./associate_with.ts";
export * from "./chunk.ts";
export * from "./deep_merge.ts";
export * from "./distinct.ts";
export * from "./distinct_by.ts";
export * from "./drop_last_while.ts";
export * from "./drop_while.ts";
export * from "./filter_entries.ts";
export * from "./filter_keys.ts";
export * from "./filter_values.ts";
export * from "./find_single.ts";
export * from "./first_not_nullish_of.ts";
export * from "./includes_value.ts";
export * from "./intersect.ts";
export * from "./invert_by.ts";
export * from "./invert.ts";
export * from "./join_to_string.ts";
export * from "./map_entries.ts";
export * from "./map_keys.ts";
export * from "./map_not_nullish.ts";
export * from "./map_values.ts";
export * from "./max_by.ts";
export * from "./max_of.ts";
export * from "./max_with.ts";
export * from "./min_by.ts";
export * from "./min_of.ts";
export * from "./min_with.ts";
export * from "./omit.ts";
export * from "./partition.ts";
export * from "./partition_entries.ts";
export * from "./permutations.ts";
export * from "./pick.ts";
export * from "./reduce_groups.ts";
export * from "./running_reduce.ts";
export * from "./sample.ts";
export * from "./sliding_windows.ts";
export * from "./sort_by.ts";
export * from "./sum_of.ts";
export * from "./take_last_while.ts";
export * from "./take_while.ts";
export * from "./union.ts";
export * from "./unzip.ts";
export * from "./without_all.ts";
export * from "./zip.ts";
