/*
* pandoc-partition.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { assert } from "testing/asserts";
import { Metadata } from "../../src/config/types.ts";
import { partitionMarkdown } from "../../src/core/pandoc/pandoc-partition.ts";
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
