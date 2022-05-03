/*
* break-quarto-md.test.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { breakQuartoMd } from "../../src/core/lib/break-quarto-md.ts";
import { unitTest } from "../test.ts";
import { assert } from "testing/asserts.ts";

unitTest("break-quarto-md - indented code cells", async () => {
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

unitTest("break-quarto-md - math", async () => {
  const qmd = `---
title: foo
---

Some text;

$$
e = mc^2
$$ {#eq-black-scholes}

Some more text;
`;

  const cells = (await breakQuartoMd(qmd, false)).cells;
  assert(cells.length === 4);
  assert(!cells[3].source.value.startsWith("$$"));
});

unitTest("break-quarto-md - code", async () => {
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
