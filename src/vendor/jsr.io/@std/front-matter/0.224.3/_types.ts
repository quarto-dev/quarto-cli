// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

/**
 * Supported format for front matter. `"unknown"` is used when auto format
 * detection logic fails.
 */
export type Format = "yaml" | "toml" | "json" | "unknown";
