/*
 * core/lib/level-one-headings.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../../test.ts";
import { assertEquals } from "testing/asserts";
import { hasLevelOneHeadings } from "../../../../src/core/lib/markdown-analysis/level-one-headings.ts";

unitTest("level-one-headings - footnote in author with H1s", async () => {
  const markdown = `---
title: "Header test"
author: "Jane Doe^[A footnote in the author field.]"
---

# Introduction

## First Hypothesis

# Conclusion
`;
  assertEquals(await hasLevelOneHeadings(markdown), true);
});

unitTest(
  "level-one-headings - footnotes in title, subtitle and abstract with H1s",
  async () => {
    const markdown = `---
title: "T^[n1]"
subtitle: "S^[n2]"
abstract: "A^[n3]"
---

# One
`;
    assertEquals(await hasLevelOneHeadings(markdown), true);
  },
);

unitTest(
  "level-one-headings - level-two-only with metadata footnote",
  async () => {
    const markdown = `---
title: "T^[n1]"
---

## Only level two
`;
    assertEquals(await hasLevelOneHeadings(markdown), false);
  },
);

unitTest("level-one-headings - hash comment in code block", async () => {
  const markdown = `\`\`\`python
# a comment
\`\`\`

## Real heading
`;
  assertEquals(await hasLevelOneHeadings(markdown), false);
});

unitTest("level-one-headings - plain H1", async () => {
  assertEquals(await hasLevelOneHeadings("# One\n"), true);
});
