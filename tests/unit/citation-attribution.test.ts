/*
 * citation-attribution.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals, assertStringIncludes } from "testing/asserts";
import { renderBibTex, renderHtml } from "../../src/core/bibliography.ts";
import { CSL } from "../../src/core/csl.ts";
import { parseHtml } from "../../src/core/deno-dom.ts";
import { unitTest } from "../test.ts";

function citation(title: string): CSL {
  return {
    id: "larsson2026",
    type: "webpage",
    title,
    author: [{ given: "Johan", family: "Larsson" }],
    issued: { "date-parts": [[2026]], "iso-8601": "2026" },
  };
}

unitTest("citation attribution - decode HTML entities in titles", async () => {
  const title = "A sound and complete proof system (part&nbsp;1)";
  const entry = citation(title);
  const html = await renderHtml(entry);
  const doc = await parseHtml(html!);

  assertStringIncludes(
    doc.querySelector(".csl-entry")!.textContent.toLowerCase(),
    "part\u00a01",
  );
  assertEquals(entry.title, title);
});

unitTest("citation attribution - preserve CSL inline formatting", async () => {
  const html = await renderHtml(
    citation(
      "<i>R &amp; Rust</i> and &#34;Julia&#34;: O&#x27;Brien&#39;s work",
    ),
  );
  const doc = await parseHtml(html!);

  assertEquals(doc.querySelector(".csl-entry em")!.textContent, "R & Rust");
  assertEquals(
    html,
    await renderHtml(
      citation("<i>R & Rust</i> and \"Julia\": O'Brien's work"),
    ),
  );
});

unitTest("citation attribution - decode entities only once", async () => {
  const html = await renderHtml(
    citation("Literal &amp;nbsp; and &notanentity; and R&notebook and &#123"),
  );
  const doc = await parseHtml(html!);

  const text = doc.querySelector(".csl-entry")!.textContent.toLowerCase();
  for (
    const literal of ["literal &nbsp;", "&notanentity;", "r&notebook", "&#123"]
  ) {
    assertStringIncludes(text, literal);
  }
});

unitTest("citation attribution - decode entities for BibLaTeX", async () => {
  const bibtex = await renderBibTex(
    citation("A sound and complete proof system (part&nbsp;1)"),
  );
  assert(/Part(?:~|\\ )1/.test(bibtex!));
});
