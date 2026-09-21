/*
 * typst-fonts.test.ts
 *
 * Unit tests for Typst font enumeration and parsing.
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { parseTypstFontsOutput } from "../../src/core/typst.ts";

unitTest("parseTypstFontsOutput - parses one font per line", async () => {
  const output = "Arial\nDejaVu Sans Mono\nLibertinus Serif\n";
  const result = parseTypstFontsOutput(output);
  assertEquals(result, ["arial", "dejavu sans mono", "libertinus serif"]);
});

unitTest("parseTypstFontsOutput - trims whitespace and blank lines", async () => {
  const output = "  Arial  \n\n  DejaVu Sans  \n  \n";
  const result = parseTypstFontsOutput(output);
  assertEquals(result, ["arial", "dejavu sans"]);
});

unitTest("parseTypstFontsOutput - empty output returns empty array", async () => {
  const result = parseTypstFontsOutput("");
  assertEquals(result, []);
});

unitTest("parseTypstFontsOutput - handles windows line endings", async () => {
  const output = "Arial\r\nTimes New Roman\r\n";
  const result = parseTypstFontsOutput(output);
  assertEquals(result, ["arial", "times new roman"]);
});
