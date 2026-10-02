/*
 * project-book-llms-crossrefs.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";

import { testQuartoCmd } from "../../test.ts";
import { runQuarto } from "../../quarto-cmd.ts";
import { docs } from "../../utils.ts";
import {
  ensureFileRegexMatches,
  ensureHtmlElements,
  ensureLlmsMdRegexMatches,
  fileExists,
  noErrorsOrWarnings,
} from "../../verify.ts";

// Book chapters resolve cross-references in post-render, after every chapter
// has rendered; their .llms.md files must carry the resolved numbers and links.
const projectDir = docs("project/book-llms-crossrefs");
const outDir = join(projectDir, "_book");
const secondHtml = join(outDir, "second.html");
const thirdHtml = join(outDir, "third.html");

const cleanup = async () => {
  for (const dir of [outDir, join(projectDir, ".quarto")]) {
    if (existsSync(dir)) {
      await Deno.remove(dir, { recursive: true });
    }
  }
};

// \s: resolved refs separate prefix and number with U+00A0
const secondMatches = [
  /\[Equation\s1\.1\]\(#eq-one\)/,
  /\[Figure\s1\.1\]\(#fig-one\)/,
  /\[Table\s2\.1\]\(third\.llms\.md#tbl-three\)/,
  /\[Chapter\s2\]\(third\.llms\.md\)/,
];
const secondNoMatches = [
  /Equation\seq-one/,
  /Figure\sfig-one/,
  /Table\stbl-three/,
  /\[sec-third\]/,
  /\]\(#tbl-three\)/,
];

testQuartoCmd(
  "render",
  [projectDir],
  [
    noErrorsOrWarnings,
    fileExists(join(outDir, "llms.txt")),
    ensureLlmsMdRegexMatches(secondHtml, secondMatches, secondNoMatches),
    ensureLlmsMdRegexMatches(
      thirdHtml,
      [/\[Figure\s1\.1\]\(second\.llms\.md#fig-one\)/, /LLMSONLYCHAPTERTEXT/],
      [/Figure\sfig-one/, /HTMLONLYCHAPTERTEXT/],
    ),
    ensureHtmlElements(
      thirdHtml,
      ["#tbl-three"],
      [".llms-conditional-content", ".llms-hidden-content"],
    ),
    ensureFileRegexMatches(
      thirdHtml,
      [/HTMLONLYCHAPTERTEXT/],
      [/LLMSONLYCHAPTERTEXT/],
    ),
  ],
  {
    setup: cleanup,
    teardown: cleanup,
  },
  "book .llms.md resolves cross-references (full render)",
);

testQuartoCmd(
  "render",
  [join(projectDir, "second.qmd")],
  [
    noErrorsOrWarnings,
    ensureLlmsMdRegexMatches(secondHtml, secondMatches, secondNoMatches),
  ],
  {
    setup: async () => {
      await cleanup();
      await runQuarto(["render", projectDir]);
      await Deno.remove(join(outDir, "second.llms.md"));
    },
    teardown: cleanup,
  },
  "book .llms.md resolves cross-references (single chapter render)",
);
