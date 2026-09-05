/*
* jupyter-yaml-delimiter.test.ts
*
* Test for issue #10436: YAML closing delimiter detection with blank lines
*
* Copyright (C) 2020-2026 Posit Software, PBC
*/
import { assertEquals, assert } from "testing/asserts";
import { quartoMdToJupyter } from "../../../src/core/jupyter/jupyter.ts";
import { unitTest } from "../../test.ts";

unitTest("quartoMdToJupyter: mid-document YAML with blank line", async () => {
  const markdown = `---
title: "Test Document"
---

## Section 1

Some intro text.

---
jupyter: python3
title: "Mid-Document Block"
---

More content after YAML.

\`\`\`{python}
2 + 2
\`\`\`
`;

  const notebook = await quartoMdToJupyter(markdown, false);

  // Verify we have the correct number of cells
  assertEquals(notebook.cells.length, 5);

  // Cell 0: raw cell with document frontmatter
  assertEquals(notebook.cells[0].cell_type, "raw");
  const cell0Source = Array.isArray(notebook.cells[0].source)
    ? notebook.cells[0].source.join("")
    : notebook.cells[0].source;
  assert(cell0Source.includes('title: "Test Document"'));

  // Cell 1: markdown cell with intro
  assertEquals(notebook.cells[1].cell_type, "markdown");
  const cell1Source = Array.isArray(notebook.cells[1].source)
    ? notebook.cells[1].source.join("")
    : notebook.cells[1].source;
  assert(cell1Source.includes("## Section 1"));
  assert(cell1Source.includes("Some intro text."));

  // Cell 2: raw cell with mid-document YAML (THE KEY TEST)
  assertEquals(notebook.cells[2].cell_type, "raw");
  const cell2Source = Array.isArray(notebook.cells[2].source)
    ? notebook.cells[2].source.join("")
    : notebook.cells[2].source;

  // CRITICAL: Verify YAML delimiters are correct
  assert(cell2Source.startsWith("---\n"), "Mid-document YAML should start with ---\\n");
  assert(cell2Source.includes("jupyter: python3"), "Should contain YAML content");
  assert(cell2Source.includes('title: "Mid-Document Block"'), "Should contain YAML content");
  assert(cell2Source.endsWith("---"), "Mid-document YAML should end with ---");

  // CRITICAL: Verify NO blank line after opening ---
  assert(!cell2Source.match(/^---\n\njupyter:/), "Should NOT have blank line after opening ---");

  // Cell 3: markdown cell with content after YAML
  assertEquals(notebook.cells[3].cell_type, "markdown");
  const cell3Source = Array.isArray(notebook.cells[3].source)
    ? notebook.cells[3].source.join("")
    : notebook.cells[3].source;
  assert(cell3Source.includes("More content after YAML."));

  // Cell 4: code cell
  assertEquals(notebook.cells[4].cell_type, "code");
  const cell4Source = Array.isArray(notebook.cells[4].source)
    ? notebook.cells[4].source.join("")
    : notebook.cells[4].source;
  assert(cell4Source.includes("2 + 2"));
});

unitTest("quartoMdToJupyter: multiple mid-document YAML blocks", async () => {
  const markdown = `---
title: "Main"
---

## First Section

---
config1: value1
---

Content between.

---
config2: value2
---

\`\`\`{python}
print("test")
\`\`\`
`;

  const notebook = await quartoMdToJupyter(markdown, false);

  // Should have 6 cells: frontmatter, intro, yaml1, content, yaml2, code
  assertEquals(notebook.cells.length, 6);

  // Verify cell types
  assertEquals(notebook.cells[0].cell_type, "raw");  // frontmatter
  assertEquals(notebook.cells[1].cell_type, "markdown");  // "## First Section"
  assertEquals(notebook.cells[2].cell_type, "raw");  // first YAML block
  assertEquals(notebook.cells[3].cell_type, "markdown");  // "Content between."
  assertEquals(notebook.cells[4].cell_type, "raw");  // second YAML block
  assertEquals(notebook.cells[5].cell_type, "code");  // python code

  // Verify both YAML blocks have correct structure
  const yaml1 = Array.isArray(notebook.cells[2].source)
    ? notebook.cells[2].source.join("")
    : notebook.cells[2].source;
  assert(yaml1.includes("config1: value1"));
  assert(!yaml1.match(/^---\n\nconfig1/));  // No blank line

  const yaml2 = Array.isArray(notebook.cells[4].source)
    ? notebook.cells[4].source.join("")
    : notebook.cells[4].source;
  assert(yaml2.includes("config2: value2"));
  assert(!yaml2.match(/^---\n\nconfig2/));  // No blank line
});

unitTest("quartoMdToJupyter: slide separators not treated as YAML", async () => {
  const markdown = `---
title: "Presentation"
format: revealjs
---

# Slide 1

Content on first slide.

---

# Slide 2

Content on second slide.

\`\`\`{python}
x = 1
\`\`\`
`;

  const notebook = await quartoMdToJupyter(markdown, false);

  // The --- between slides should NOT create a YAML cell
  // Should have: frontmatter + markdown (all slides together) + code
  assertEquals(notebook.cells.length, 3);

  assertEquals(notebook.cells[0].cell_type, "raw");  // frontmatter
  assertEquals(notebook.cells[1].cell_type, "markdown");  // all slide content
  assertEquals(notebook.cells[2].cell_type, "code");  // python

  // Verify the markdown cell contains the slide separator
  const markdownSource = Array.isArray(notebook.cells[1].source)
    ? notebook.cells[1].source.join("")
    : notebook.cells[1].source;
  assert(markdownSource.includes("---"), "Slide separator should be in markdown");
  assert(markdownSource.includes("# Slide 1"));
  assert(markdownSource.includes("# Slide 2"));
});
