/*
 * text-highlighting.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import {
  getHighlightTheme,
  hasAdaptiveTheme,
  hasTextHighlighting,
  isAdaptiveTheme,
} from "../../src/quarto-core/text-highlighting.ts";
import { FormatPandoc } from "../../src/config/types.ts";

// getHighlightTheme tests

// deno-lint-ignore require-await
unitTest("getHighlightTheme - returns default when no options set", async () => {
  const pandoc: FormatPandoc = {};
  assertEquals(getHighlightTheme(pandoc), "arrow");
});

// deno-lint-ignore require-await
unitTest("getHighlightTheme - returns syntax-highlighting when set", async () => {
  const pandoc: FormatPandoc = { "syntax-highlighting": "github" };
  assertEquals(getHighlightTheme(pandoc), "github");
});

// deno-lint-ignore require-await
unitTest("getHighlightTheme - returns highlight-style as fallback", async () => {
  const pandoc: FormatPandoc = { "highlight-style": "monokai" };
  assertEquals(getHighlightTheme(pandoc), "monokai");
});

// deno-lint-ignore require-await
unitTest("getHighlightTheme - syntax-highlighting takes precedence", async () => {
  const pandoc: FormatPandoc = {
    "syntax-highlighting": "github",
    "highlight-style": "monokai",
  };
  assertEquals(getHighlightTheme(pandoc), "github");
});

// hasTextHighlighting tests

// deno-lint-ignore require-await
unitTest("text-highlighting - returns true when no options set (default applies)", async () => {
  const pandoc: FormatPandoc = {};
  assertEquals(hasTextHighlighting(pandoc), true);
});

// deno-lint-ignore require-await
unitTest("text-highlighting - returns false when disabled with 'none'", async () => {
  const pandoc: FormatPandoc = { "syntax-highlighting": "none" };
  assertEquals(hasTextHighlighting(pandoc), false);
});

// deno-lint-ignore require-await
unitTest("text-highlighting - returns true for explicit theme", async () => {
  const pandoc: FormatPandoc = { "syntax-highlighting": "github" };
  assertEquals(hasTextHighlighting(pandoc), true);
});

// deno-lint-ignore require-await
unitTest("text-highlighting - returns true for deprecated highlight-style", async () => {
  const pandoc: FormatPandoc = { "highlight-style": "monokai" };
  assertEquals(hasTextHighlighting(pandoc), true);
});

// deno-lint-ignore require-await
unitTest("text-highlighting - syntax-highlighting takes precedence over highlight-style", async () => {
  // New option takes precedence - "none" disables regardless of deprecated option
  const pandoc: FormatPandoc = {
    "syntax-highlighting": "none",
    "highlight-style": "github",
  };
  // "none" is truthy so it's selected, then hasTextHighlighting returns false
  assertEquals(hasTextHighlighting(pandoc), false);
});

// deno-lint-ignore require-await
unitTest("text-highlighting - returns false for deprecated highlight-style: none", async () => {
  const pandoc: FormatPandoc = { "highlight-style": "none" };
  assertEquals(hasTextHighlighting(pandoc), false);
});

// isAdaptiveTheme tests

// deno-lint-ignore require-await
unitTest("isAdaptiveTheme - returns true for known adaptive themes", async () => {
  const adaptiveThemes = [
    "a11y",
    "arrow",
    "atom-one",
    "ayu",
    "breeze",
    "github",
    "gruvbox",
    "monochrome",
  ];
  for (const theme of adaptiveThemes) {
    assertEquals(isAdaptiveTheme(theme), true, `Expected ${theme} to be adaptive`);
  }
});

// deno-lint-ignore require-await
unitTest("isAdaptiveTheme - returns false for non-adaptive themes", async () => {
  const nonAdaptiveThemes = ["monokai", "tango", "zenburn", "kate", "pygments"];
  for (const theme of nonAdaptiveThemes) {
    assertEquals(isAdaptiveTheme(theme), false, `Expected ${theme} to be non-adaptive`);
  }
});

// deno-lint-ignore require-await
unitTest("isAdaptiveTheme - returns true for object with dark and light", async () => {
  const theme = { dark: "monokai", light: "tango" };
  assertEquals(isAdaptiveTheme(theme), true);
});

// deno-lint-ignore require-await
unitTest("isAdaptiveTheme - returns false for object without both dark and light", async () => {
  // Only dark
  assertEquals(isAdaptiveTheme({ dark: "monokai" }), false);
  // Only light
  assertEquals(isAdaptiveTheme({ light: "tango" }), false);
  // Neither (empty object)
  assertEquals(isAdaptiveTheme({}), false);
});

// hasAdaptiveTheme tests

// deno-lint-ignore require-await
unitTest("hasAdaptiveTheme - returns true for adaptive syntax-highlighting", async () => {
  const pandoc: FormatPandoc = { "syntax-highlighting": "github" };
  assertEquals(hasAdaptiveTheme(pandoc), true);
});

// deno-lint-ignore require-await
unitTest("hasAdaptiveTheme - returns false for non-adaptive theme", async () => {
  const pandoc: FormatPandoc = { "syntax-highlighting": "monokai" };
  assertEquals(hasAdaptiveTheme(pandoc), false);
});

// deno-lint-ignore require-await
unitTest("hasAdaptiveTheme - returns true for deprecated highlight-style", async () => {
  const pandoc: FormatPandoc = { "highlight-style": "github" };
  assertEquals(hasAdaptiveTheme(pandoc), true);
});

// deno-lint-ignore require-await
unitTest("hasAdaptiveTheme - uses default theme when nothing set", async () => {
  // Default theme is "arrow" which is adaptive
  const pandoc: FormatPandoc = {};
  assertEquals(hasAdaptiveTheme(pandoc), true);
});
