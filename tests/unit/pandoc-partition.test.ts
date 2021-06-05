import { assert } from "testing/asserts.ts";
import { partitionMarkdown } from "../../src/core/pandoc/pandoc-partition.ts";

Deno.test("partitionYaml", () => {
  const frontMatter = "---\ntitle: foo\n---";
  const headingText = "## Hello World {#cool .foobar foo=bar}";
  const markdown = "\n\nThis is a paragraph\n\n:::{#refs}\n:::\n";

  const markdownstr = `${frontMatter}\n${headingText}${markdown}`;
  const partmd = partitionMarkdown(markdownstr);
  assert(partmd.containsRefs, "Refs Div not found");
  assert(partmd.markdown === markdown, "Partitioned markdown doesn't match");
  assert(partmd.yaml === frontMatter, "Partitioned front matter doesn't match");
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
