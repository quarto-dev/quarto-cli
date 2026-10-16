/*
 * scholar-references.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { Element, parseHtml } from "../../src/core/deno-dom.ts";
import { join } from "../../src/deno_ral/path.ts";
import { metadataPostProcessor } from "../../src/format/html/format-html-meta.ts";
import { unitTest } from "../test.ts";
import { withTempDir } from "../utils.ts";
import { createMockFormat } from "./format-utils.ts";

function referenceTitles(body: string) {
  return withTempDir(async (dir) => {
    Deno.writeTextFileSync(
      join(dir, "references.bib"),
      `@article{cited, title={Cited reference}, author={Smith, Alice}, year={2024}}
       @article{included, title={Included reference}, author={Jones, Bob}, year={2025}}
       @article{unused, title={Unused reference}, author={Brown, Carol}, year={2026}}
       @article{key:with/slash.dot, title={Punctuation reference}, author={Davis, Dan}, year={2023}}`,
    );
    const format = createMockFormat({
      metadata: {
        title: "An article",
        "google-scholar": true,
        bibliography: "references.bib",
      },
    });
    const doc = await parseHtml(
      `<html><head></head><body>${body}</body></html>`,
    );
    await metadataPostProcessor(join(dir, "test.qmd"), format)(doc, {
      inputMetadata: format.metadata,
      inputTraits: {},
      renderedFormats: [],
    });
    const rendered = await parseHtml(doc.documentElement!.outerHTML);
    return [...rendered.querySelectorAll('meta[name="citation_reference"]')]
      .map((element) =>
        (element as Element).getAttribute("content")!
          .match(/citation_title=([^;]+);/)![1].toLowerCase()
      )
      .sort();
  });
}

// Pandoc applies the identifier prefix to the container and its entries.
function bibliography(entries: string, identifierPrefix = "") {
  return `<div id="${identifierPrefix}refs" class="references csl-bib-body">${entries}</div>`;
}

unitTest("Scholar references - omit an unused bibliography", async () => {
  assertEquals(await referenceTitles("<p>No citations.</p>"), []);
});

unitTest(
  "Scholar references - keep cited works without a bibliography section",
  async () => {
    assertEquals(
      await referenceTitles(
        '<span class="citation" data-cites="cited">A citation</span>',
      ),
      ["cited reference"],
    );
  },
);

unitTest("Scholar references - include rendered nocite entries", async () => {
  assertEquals(
    await referenceTitles(
      bibliography('<div id="ref-included" class="csl-entry">An entry</div>'),
    ),
    ["included reference"],
  );
});

unitTest("Scholar references - deduplicate repeated citations", async () => {
  assertEquals(
    await referenceTitles(`
      <span class="citation" data-cites="cited included">Citations</span>
      <span class="citation" data-cites="cited">Repeated citation</span>
      ${bibliography('<div id="ref-included" class="csl-entry">An entry</div>')}
    `),
    ["cited reference", "included reference"],
  );
});

unitTest("Scholar references - preserve citation key punctuation", async () => {
  assertEquals(
    await referenceTitles(
      '<span class="citation" data-cites="key:with/slash.dot">A citation</span>',
    ),
    ["punctuation reference"],
  );
});

unitTest(
  "Scholar references - ignore unrelated IDs and unknown citations",
  async () => {
    assertEquals(
      await referenceTitles(`
      <div id="ref-unused">An unrelated element</div>
      <div id="unused" class="csl-entry">An unrelated entry</div>
      <span class="citation" data-cites="unknown">An unresolved citation</span>
    `),
      [],
    );
  },
);

unitTest(
  "Scholar references - include entries under an identifier prefix",
  async () => {
    assertEquals(
      await referenceTitles(
        bibliography(
          '<div id="page-ref-included" class="csl-entry">An entry</div>',
          "page-",
        ),
      ),
      ["included reference"],
    );
  },
);
