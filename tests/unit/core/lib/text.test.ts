/*
 * core/lib/text.test.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { unitTest } from "../../../test.ts";
import { assertEquals } from "testing/asserts";
import { getEndingNewlineCount, lines } from "../../../../src/core/lib/text.ts";

unitTest("core/lib/text.ts - getEndingNewlineCount", async () => {
  // Test case 1: No trailing newlines
  assertEquals(getEndingNewlineCount(["content without newlines"]), 0);
  assertEquals(getEndingNewlineCount(["line1", "line2", "line3"]), 0);

  // Test case 2: Single line with trailing newlines
  assertEquals(getEndingNewlineCount(["content\n"]), 1);
  assertEquals(getEndingNewlineCount(["content\n\n\n"]), 3);

  // Test case 3: Multiple lines with the last line having trailing newlines
  assertEquals(getEndingNewlineCount(["line1", "line2", "line3\n\n"]), 2);
  assertEquals(getEndingNewlineCount(["line1\n", "line2\n", "line3\n\n\n"]), 3);

  // Test case 4: Empty lines at the end
  assertEquals(getEndingNewlineCount(["content", "", ""]), 0);

  // Test case 5: Lines with only newlines at the end
  assertEquals(getEndingNewlineCount(["content", "\n", "\n\n"]), 3);
  assertEquals(getEndingNewlineCount(["content", "\n\n\n"]), 3);

  // Test case 6: Mixed scenario with empty lines and lines with only newlines
  assertEquals(getEndingNewlineCount(["content\n", "", "\n\n", ""]), 3);
  assertEquals(getEndingNewlineCount(["content", "", "\n", "\n\n", ""]), 3);

  // Test case 7: Edge case with only empty strings
  assertEquals(getEndingNewlineCount(["", "", ""]), 0);

  // Test case 8: Edge case with an empty array
  assertEquals(getEndingNewlineCount([]), 0);

  // Test case 9: Content after newlines breaks the counting
  assertEquals(getEndingNewlineCount(["line1\n\n", "line2"]), 0);
  assertEquals(getEndingNewlineCount(["line1", "line2\n\n", "line3"]), 0);

  // Test case 10: Complex scenario with mixed content
  assertEquals(
    getEndingNewlineCount([
      "some content",
      "more content\n",
      "\n",
      "",
      "final line\n\n",
    ]),
    2,
  );
  assertEquals(
    getEndingNewlineCount([
      "line1",
      "line2",
      "line3\nwith content",
      "\n",
      "\n\n",
    ]),
    3,
  );
});

// Test for lines() function with different line endings
// See: https://github.com/quarto-dev/quarto-cli/issues/13998
unitTest("core/lib/text.ts - lines() with different line endings", async () => {
  // LF (Unix/Linux)
  assertEquals(lines("a\nb\nc"), ["a", "b", "c"]);

  // CRLF (Windows)
  assertEquals(lines("a\r\nb\r\nc"), ["a", "b", "c"]);

  // CR-only (old Mac) - the fix for #13998
  assertEquals(lines("a\rb\rc"), ["a", "b", "c"]);

  // Mixed endings
  assertEquals(lines("a\rb\nc\r\nd"), ["a", "b", "c", "d"]);

  // YAML front matter with CR-only
  const yaml = "---\rtitle: \"Test\"\r---";
  assertEquals(lines(yaml), ["---", "title: \"Test\"", "---"]);

  // Empty string
  assertEquals(lines(""), [""]);

  // Single line without newline
  assertEquals(lines("single"), ["single"]);

  // Trailing newlines
  assertEquals(lines("a\n"), ["a", ""]);
  assertEquals(lines("a\r"), ["a", ""]);
  assertEquals(lines("a\r\n"), ["a", ""]);
});
