/*
* pandoc-partition.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { assert, assertEquals } from "testing/asserts";
import { Metadata } from "../../src/config/types.ts";
import { languagesWithClasses, markdownWithExtractedHeading, partitionMarkdown } from "../../src/core/pandoc/pandoc-partition.ts";
import { unitTest } from "../test.ts";

// deno-lint-ignore require-await
unitTest("partitionYaml", async () => {
  const frontMatter = "---\ntitle: foo\n---";
  const headingText = "## Hello World {#cool .foobar foo=bar}";
  const markdown = "\n\nThis is a paragraph\n\n:::{#refs}\n:::\n";

  const markdownstr = `${frontMatter}\n${headingText}${markdown}`;
  const partmd = partitionMarkdown(markdownstr);

  const metadataMatches = (yaml?: Metadata) => {
    if (yaml) {
      return yaml.title === "foo" && Object.keys(yaml).length === 1;
    } else {
      return false;
    }
  };

  // Tests of the result
  assert(partmd.containsRefs, "Refs Div not found");
  assert(partmd.markdown === markdown, "Partitioned markdown doesn't match");
  assert(
    metadataMatches(partmd.yaml),
    "Partitioned front matter doesn't match",
  );
  assert(
    partmd.headingText === "Hello World",
    "Heading text not parsed properly",
  );
  assert(
    partmd.headingAttr?.id === "cool",
    "Heading missing id",
  );
  assert(
    partmd.headingAttr?.classes.includes("foobar"),
    "Heading missing class",
  );
  assert(
    partmd.headingAttr?.keyvalue[0][0] === "foo",
    "Heading missing attribute key",
  );
  assert(
    partmd.headingAttr?.keyvalue[0][1] === "bar",
    "Heading missing attribute value",
  );
});

// deno-lint-ignore require-await
unitTest("languagesWithClasses - dot-joined syntax", async () => {
  const md = `\`\`\`{python.marimo}
x = 1
\`\`\`

\`\`\`{python .foo}
y = 2
\`\`\`
`;
  const result = languagesWithClasses(md);
  // {python.marimo} → language "python.marimo", no class
  assert(result.has("python.marimo"), "Should have language 'python.marimo'");
  assert(result.get("python.marimo") === undefined, "python.marimo should have no class");
  // {python .foo} → language "python", class "foo"
  assert(result.has("python"), "Should have language 'python'");
  assert(result.get("python") === "foo", "python should have class 'foo'");
});

// deno-lint-ignore require-await
unitTest(
  "markdownWithExtractedHeading - ignores an ATX-heading-like line inside a fenced code block",
  async () => {
    const markdown = [
      "```{python}",
      "print('hello')",
      "# plt.savefig('x.svg')",
      "```",
    ].join("\n");
    const result = markdownWithExtractedHeading(markdown);
    assertEquals(
      result.headingText,
      undefined,
      "A comment inside a fenced code block must not be treated as a heading",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "markdownWithExtractedHeading - still extracts a real heading after a closed fenced code block",
  async () => {
    const markdown = [
      "```{python}",
      "print('hello')",
      "```",
      "",
      "# Real Heading",
    ].join("\n");
    const result = markdownWithExtractedHeading(markdown);
    assertEquals(result.headingText, "Real Heading");
    assert(
      result.contentBeforeHeading,
      "The fenced block content should still count as content before the heading",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "markdownWithExtractedHeading - still promotes a heading that follows a prose paragraph (no fence)",
  async () => {
    const markdown = [
      "Some intro paragraph.",
      "",
      "# Real Heading",
    ].join("\n");
    const result = markdownWithExtractedHeading(markdown);
    assertEquals(
      result.headingText,
      "Real Heading",
      "Non-fenced prose before a heading must not prevent heading extraction",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "markdownWithExtractedHeading - ignores an ATX-heading-like line inside a tilde-fenced code block",
  async () => {
    const markdown = [
      "~~~python",
      "# not a heading",
      "~~~",
    ].join("\n");
    const result = markdownWithExtractedHeading(markdown);
    assertEquals(result.headingText, undefined);
  },
);

// deno-lint-ignore require-await
unitTest(
  "markdownWithExtractedHeading - ignores an ATX-heading-like line inside a fenced code block whose fence markers are indented up to 3 spaces",
  async () => {
    const markdown = [
      "- a list item with a nested code block",
      "",
      "  ```python",
      "# not a heading",
      "  ```",
    ].join("\n");
    const result = markdownWithExtractedHeading(markdown);
    assertEquals(result.headingText, undefined);
  },
);

// deno-lint-ignore require-await
unitTest(
  "markdownWithExtractedHeading - closes a fence whose closing marker is indented, then extracts the following heading",
  async () => {
    const markdown = [
      "```python",
      "code",
      "   ```",
      "# Real Heading",
    ].join("\n");
    const result = markdownWithExtractedHeading(markdown);
    assertEquals(result.headingText, "Real Heading");
  },
);

// deno-lint-ignore require-await
unitTest(
  "markdownWithExtractedHeading - extracts a setext-style heading",
  async () => {
    const markdown = [
      "Real Heading",
      "===",
    ].join("\n");
    const result = markdownWithExtractedHeading(markdown);
    assertEquals(result.headingText, "Real Heading");
    assertEquals(result.lines, []);
  },
);

// deno-lint-ignore require-await
unitTest(
  "markdownWithExtractedHeading - no heading present",
  async () => {
    const markdown = [
      "Just a paragraph.",
      "",
      "Another paragraph.",
    ].join("\n");
    const result = markdownWithExtractedHeading(markdown);
    assertEquals(result.headingText, undefined);
    assertEquals(result.lines, markdown.split("\n"));
  },
);

// deno-lint-ignore require-await
unitTest(
  "markdownWithExtractedHeading - contentBeforeHeading is false when the heading is the first line",
  async () => {
    const markdown = [
      "# Real Heading",
      "",
      "Some body text.",
    ].join("\n");
    const result = markdownWithExtractedHeading(markdown);
    assertEquals(result.headingText, "Real Heading");
    assertEquals(result.contentBeforeHeading, false);
  },
);
