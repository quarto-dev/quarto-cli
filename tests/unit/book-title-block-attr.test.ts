/*
 * book-title-block-attr.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { execProcess } from "../../src/core/process.ts";
import { pandocBinaryPath } from "../../src/core/resources.ts";
import { bookTitleBlockMarkdown } from "../../src/project/types/book/book-render.ts";

// Pandoc's markdown reader consumes a backslash that precedes an ASCII
// punctuation character inside a quoted attribute value, so a Windows path
// with a directory whose name starts with punctuation loses that separator
// unless the value is escaped when the attribute is generated.
const kTemplatePath =
  "D:\\a\\_temp\\quarto-under-test\\share\\projects\\book\\pandoc\\title-block.md";

async function templateAttrAfterPandocRoundTrip(
  markdown: string,
): Promise<string> {
  const result = await execProcess(
    {
      cmd: pandocBinaryPath(),
      args: ["--from", "markdown", "--to", "json"],
      stdout: "piped",
      stderr: "piped",
    },
    markdown,
  );
  assertEquals(result.code, 0, `pandoc failed: ${result.stderr}`);

  // deno-lint-ignore no-explicit-any
  const doc = JSON.parse(result.stdout!) as any;
  // deno-lint-ignore no-explicit-any
  const titleBlock = doc.blocks.find((block: any) =>
    block.t === "CodeBlock" && block.c[0][1].includes("quarto-title-block")
  );
  assertEquals(
    titleBlock !== undefined,
    true,
    "no quarto-title-block code cell in the generated markdown",
  );
  const template = titleBlock.c[0][2].find(
    (keyvalue: [string, string]) => keyvalue[0] === "template",
  );
  assertEquals(
    template !== undefined,
    true,
    "quarto-title-block code cell has no template attribute",
  );
  return template[1];
}

unitTest(
  "book title block - template path survives pandoc attribute parsing",
  async () => {
    const markdown = bookTitleBlockMarkdown(kTemplatePath, {
      title: "A Chapter",
    });
    assertEquals(
      await templateAttrAfterPandocRoundTrip(markdown),
      kTemplatePath,
    );
  },
);
