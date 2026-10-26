/*
 * markdown-pipeline.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 *
 */
import { unitTest } from "../test.ts";
import { assertStringIncludes } from "testing/asserts";
import { createMarkdownRenderEnvelope } from "../../src/core/markdown-pipeline.ts";

// Each inline span must be separated by a blank line (double newline) so that
// pandoc's markdown reader parses each as its own paragraph. A single newline
// joins all titles into one paragraph, triggering exponential emphasis-matcher
// parse time on many `__x__`-style titles (GH #14576).
// deno-lint-ignore require-await
unitTest(
  "markdown-pipeline - inline spans separated by blank line (#14576)",
  async () => {
    const envelope = createMarkdownRenderEnvelope("test-envelope", {
      inlines: {
        first: "alpha",
        second: "beta",
      },
    });

    assertStringIncludes(
      envelope,
      "render-id=\"Zmlyc3Q=\"}\n\n[beta]",
      "Inline spans must be separated by a blank line so pandoc parses each as its own paragraph",
    );
  },
);
