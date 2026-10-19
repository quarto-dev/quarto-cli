/*
 * block-fence.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import {
  pandocCode,
  pandocDiv,
  pandocRawStr,
} from "../../../src/core/pandoc/codegen.ts";

// deno-lint-ignore require-await
unitTest(
  "pandoc-codegen - code fence is longer than the longest backtick run",
  async () => {
    const block = pandocCode({
      language: "=html",
      contents: [pandocRawStr("a `b` c\n```\nd\n")],
    });
    assertEquals(
      block.mappedString().value,
      "\n````{=html}\na `b` c\n```\nd\n````\n",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "pandoc-codegen - div fence is longer than the longest colon run",
  async () => {
    const block = pandocDiv({
      contents: [pandocRawStr("a: b\n:::: {}\n")],
    });
    assertEquals(
      block.mappedString().value,
      "\n:::::{}\na: b\n:::: {}\n:::::\n",
    );
  },
);
