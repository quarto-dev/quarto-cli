/*
 * scholar-metadata.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals, assertStringIncludes } from "testing/asserts";
import { Metadata } from "../../src/config/types.ts";
import { bibliographyCslJson } from "../../src/core/bibliography.ts";
import { parseHtml } from "../../src/core/deno-dom.ts";
import { join } from "../../src/deno_ral/path.ts";
import { metadataPostProcessor } from "../../src/format/html/format-html-meta.ts";
import { unitTest } from "../test.ts";
import { withTempDir } from "../utils.ts";
import { createMockFormat } from "./format-utils.ts";

async function scholarMetadata(
  metadata: Metadata,
  input = "test.qmd",
  body = "",
) {
  const format = createMockFormat({
    metadata: { "google-scholar": true, ...metadata },
  });
  const doc = await parseHtml(`<html><head></head><body>${body}</body></html>`);
  await metadataPostProcessor(input, format)(doc, {
    inputMetadata: format.metadata,
    inputTraits: {},
    renderedFormats: [],
  });
  return await parseHtml(doc.documentElement!.outerHTML);
}

unitTest(
  "Scholar metadata - preserve title characters after serialization",
  async () => {
    for (
      const title of [
        "What's New in Moloch 2.0.0",
        'O\'Brien\'s "R & Rust" and "Julia" <2026> & <2027>',
        "Cramér’s work and Małgorzata’s research",
      ]
    ) {
      const doc = await scholarMetadata({ title });
      assertEquals(
        doc.querySelector('meta[name="citation_title"]')!.getAttribute(
          "content",
        ),
        title,
      );
    }
  },
);

unitTest("Scholar metadata - preserve explicit citation fields", async () => {
  const title =
    "A citation title with \"quotes\" & apostrophes: O'Brien's work";
  const author = "Norah O'Brien";
  const editor = "John O'Connor";
  const abstract = 'R & Rust use "quotes", <angles>, and apostrophes.';
  const journal = "Research & Applications";
  const publisher = "O'Reilly & Associates";
  const url = "https://example.org/article?first=1&second=2&third=3";
  const doc = await scholarMetadata({
    title: "The page title",
    author,
    date: "2026-10-14",
    citation: {
      title,
      editor,
      abstract,
      "container-title": journal,
      publisher,
      url,
    },
  });

  for (
    const [name, content] of Object.entries({
      citation_title: title,
      citation_author: author,
      citation_editor: editor,
      citation_abstract: abstract,
      citation_journal_title: journal,
      citation_publisher: publisher,
      citation_fulltext_html_url: url,
      citation_year: "2026",
    })
  ) {
    assertEquals(
      doc.querySelector(`meta[name="${name}"]`)!.getAttribute("content"),
      content,
      name,
    );
  }
});

unitTest(
  "Scholar metadata - preserve reference characters after serialization",
  async () => {
    await withTempDir(async (dir) => {
      const journal = "Research & Applications";
      Deno.writeTextFileSync(
        join(dir, "references.bib"),
        `@article{obrien2026,
        title = {O'Brien's work with R \\& Rust},
        journal = {Research \\& Applications},
        author = {O'Brien, Norah},
        year = {2026}
      }`,
      );
      const input = join(dir, "test.qmd");
      const metadata = {
        title: "An article",
        bibliography: "references.bib",
      };
      const entries = await bibliographyCslJson(input, metadata);
      const entry = entries![0];
      const doc = await scholarMetadata(
        metadata,
        input,
        '<div id="refs" class="references csl-bib-body"><div id="ref-obrien2026" class="csl-entry"></div></div>',
      );
      const reference = doc.querySelector('meta[name="citation_reference"]')!
        .getAttribute("content")!;

      assertStringIncludes(reference, `citation_title=${entry.title};`);
      assertStringIncludes(
        reference,
        `citation_author=Norah ${entry.author![0].family};`,
      );
      assertStringIncludes(reference, `citation_journal_title=${journal};`);
    });
  },
);

unitTest(
  "Scholar metadata - separate reference fields with semicolon and space",
  async () => {
    await withTempDir(async (dir) => {
      Deno.writeTextFileSync(
        join(dir, "references.bib"),
        `@article{doe2020,
        title = {A title},
        journal = {A Journal},
        author = {Doe, Jane},
        year = {2020}
      }`,
      );
      const input = join(dir, "test.qmd");
      const doc = await scholarMetadata(
        { title: "An article", bibliography: "references.bib" },
        input,
        '<div id="refs" class="references csl-bib-body"><div id="ref-doe2020" class="csl-entry"></div></div>',
      );
      assertEquals(
        doc.querySelector('meta[name="citation_reference"]')!
          .getAttribute("content"),
        "citation_title=A title; citation_author=Jane Doe; " +
          "citation_publication_date=2020; citation_cover_date=2020; " +
          "citation_year=2020; citation_journal_title=A Journal;",
      );
    });
  },
);

unitTest(
  "Scholar metadata - omit book title for a chapter without container title",
  async () => {
    await withTempDir(async (dir) => {
      Deno.writeTextFileSync(
        join(dir, "references.bib"),
        `@incollection{doe2020,
        title = {A chapter},
        author = {Doe, Jane},
        year = {2020}
      }`,
      );
      const input = join(dir, "test.qmd");
      const doc = await scholarMetadata(
        {
          title: "A chapter of my own",
          citation: { type: "chapter" },
          bibliography: "references.bib",
        },
        input,
        '<div id="refs" class="references csl-bib-body"><div id="ref-doe2020" class="csl-entry"></div></div>',
      );
      assertEquals(
        doc.querySelector('meta[name="citation_inbook_title"]'),
        null,
      );
      const reference = doc.querySelector('meta[name="citation_reference"]')!
        .getAttribute("content")!;
      assertEquals(reference.includes("citation_inbook_title"), false);
    });
  },
);
