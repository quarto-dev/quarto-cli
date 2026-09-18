/*
 * render-sidebar-markdown-titles.test.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 *
 */
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync, safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { ensureFileRegexMatches, noErrors } from "../../verify.ts";

// Regression test for GH #14576 / upstream jgm/pandoc#11687.
//
// Sidebar titles are rendered through the navigation "envelope": each title
// becomes an inline span, the spans are joined into a single markdown document,
// pandoc renders it, and the results are read back. When many sidebar titles
// wrap text around a dunder name (e.g. `Transcript.__getitem__()`), joining the
// spans into one paragraph made pandoc's markdown reader backtrack
// exponentially over the unresolved `_`-emphasis candidates, hanging the
// render. The fix joins each span as its own paragraph so the parse stays
// linear. Pre-fix this render hangs (the test fails by timing out); post-fix it
// completes quickly.
//
// The project is generated on the fly rather than stored as fixtures: the many
// dunder pages would otherwise bloat the repo and each be picked up as its own
// smoke-all render target.

const dunderTitles = [
  "__init__", "__call__", "__repr__", "__str__", "__len__",
  "__getitem__", "__setitem__", "__delitem__", "__iter__", "__next__",
  "__enter__", "__exit__", "__add__", "__sub__", "__mul__",
  "__eq__", "__hash__", "__new__", "__del__", "__contains__",
];

const pageName = (i: number) => `page${String(i + 1).padStart(2, "0")}.qmd`;

const projectDir = Deno.makeTempDirSync({ prefix: "quarto-sidebar-titles" });
const outputDir = join(projectDir, "_site");

const writeProject = () => {
  ensureDirSync(projectDir);

  const sidebarContents = [
    "index.qmd",
    ...dunderTitles.map((_, i) => pageName(i)),
    "bold-page.qmd",
    "code-page.qmd",
  ].map((p) => `      - ${p}`).join("\n");

  Deno.writeTextFileSync(
    join(projectDir, "_quarto.yml"),
    `project:
  type: website
website:
  title: "Sidebar Titles"
  sidebar:
    contents:
${sidebarContents}
format:
  html:
    theme: cosmo
`,
  );

  Deno.writeTextFileSync(
    join(projectDir, "index.qmd"),
    `---\ntitle: "Home"\n---\n\nSidebar markdown-title regression guard for #14576.\n`,
  );

  dunderTitles.forEach((dunder, i) => {
    Deno.writeTextFileSync(
      join(projectDir, pageName(i)),
      `---\ntitle: "Transcript.${dunder}()"\n---\n\nPage for \`Transcript.${dunder}()\`.\n`,
    );
  });

  Deno.writeTextFileSync(
    join(projectDir, "bold-page.qmd"),
    `---\ntitle: "A **bold** word"\n---\n\nBold title page.\n`,
  );
  Deno.writeTextFileSync(
    join(projectDir, "code-page.qmd"),
    `---\ntitle: "A \`code\` word"\n---\n\nCode title page.\n`,
  );
};

testQuartoCmd(
  "render",
  [projectDir],
  [
    noErrors,
    ensureFileRegexMatches(
      join(outputDir, "index.html"),
      [
        // Dunder titles render literally (intraword_underscores keeps `__x__`
        // out of emphasis), and reaching this assertion at all proves the
        // render did not hang.
        /Transcript\.__getitem__\(\)/,
        // Markdown inside titles still renders correctly through the envelope.
        /A <strong>bold<\/strong> word/,
        /A <code>code<\/code> word/,
      ],
      [
        // A dunder name must not be turned into spurious emphasis.
        /<strong>getitem<\/strong>/,
      ],
    ),
  ],
  {
    // Performance budget: the healthy render finishes in well under this.
    // Pre-fix the exponential parse blows far past it, so the test fails fast
    // (instead of riding the default 10-minute timeout) when the fix regresses.
    timeout: 120000,
    setup: async () => {
      writeProject();
    },
    teardown: async () => {
      safeRemoveSync(projectDir, { recursive: true });
    },
  },
);
