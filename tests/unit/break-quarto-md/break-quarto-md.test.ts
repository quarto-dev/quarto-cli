/*
* break-quarto-md.test.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { breakQuartoMd } from "../../../src/core/lib/break-quarto-md.ts";
import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";
import { docs } from "../../utils.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import { lines } from "../../../src/core/lib/text.ts";

unitTest("break-quarto-md - empty code cells", async () => {
  await initYamlIntelligenceResourcesFromFilesystem();
  const qmd = Deno.readTextFileSync(
    docs("break-quarto-md/github-issue-1034.qmd"),
  );

  const result = await breakQuartoMd(qmd);
  assert(result.cells.length === 10);
});

unitTest("break-quarto-md - indented code cells", async () => {
  await initYamlIntelligenceResourcesFromFilesystem();
  const qmd = `---
title: Blah
---

Blah blah

\`\`\`{r}
1 + 1
\`\`\`

*   The same in a list:

    \`\`\`{r}
    1 + 1
    \`\`\`

*   The same in a list again:

    \`\`\`{r}
    1 + 1
    \`\`\`
`;
  const cells = (await breakQuartoMd(qmd, false)).cells;
  assert(cells.map((cell) => cell.sourceVerbatim.value).join("") === qmd);
});

unitTest("break-quarto-md - code", async () => {
  await initYamlIntelligenceResourcesFromFilesystem();
  const qmd = `---
title: mermaid test
format: html
---

## Some title

Some text

\`\`\`{mermaid}
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
\`\`\`

A cell that shouldn't be rendered by mermaid:

\`\`\`mermaid
Do not touch this, please.
\`\`\`
`;

  const cells = (await breakQuartoMd(qmd, false)).cells;
  assert(cells.length === 4);
  assert(!cells[3].sourceVerbatim.value.startsWith("```"));
});

unitTest("break-quarto-md - nested code", async () => {
  await initYamlIntelligenceResourcesFromFilesystem();
  const qmd = `---
title: mermaid test
format: html
---

## Some title

Some text, and a markdown code chunk that shouldn't be split into a real code chunk.

\`\`\`\`{.markdown}
\`\`\`{mermaid}
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
\`\`\`
\`\`\`\`

Then some text.
`;

  const cells = (await breakQuartoMd(qmd, false)).cells;
  assert(cells.length === 2);
});

unitTest("break-quarto-md - hr cells", async () => {
  await initYamlIntelligenceResourcesFromFilesystem();
  const qmd = `---
title: "Untitled"
format: html
editor: visual
keep-md: true
---


Hello, an hr.

---

Hello, another thing.

---

And what about this?
`;

  const cells = (await breakQuartoMd(qmd, false)).cells;
  assert(cells.length <= 2 || cells[2].cell_type === "markdown");
});

unitTest("break-quarto-md - hr after content (no blank line before)", async () => {
  await initYamlIntelligenceResourcesFromFilesystem();
  // HR directly after heading, followed by blank line, then more content with another HR later
  // The first HR should NOT start a YAML block that consumes content until the second HR
  const qmd = `---
title: marimo + quarto
format: html
---

# Heading
---

Some content here.

---

More content.
`;

  const cells = (await breakQuartoMd(qmd, false)).cells;

  // Check if there's a spurious raw cell after the front matter
  const rawCells = cells.filter(cell => cell.cell_type === "raw");

  // The HR on line 7 should NOT create a second raw cell
  // There should only be 1 raw cell (the front matter)
  assert(rawCells.length === 1, `Expected 1 raw cell (front matter only), got ${rawCells.length}`);

  // All non-front-matter cells should be markdown
  assert(
    cells.slice(1).every(cell => cell.cell_type === "markdown"),
    "All cells after front matter should be markdown"
  );
});
