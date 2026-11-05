/*
 * bibliography-csl-json.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { renderToCSLJSON } from "../../src/core/bibliography.ts";
import { unitTest } from "../test.ts";
import { withTempDir } from "../utils.ts";

function cslEntries(biblios: string[]) {
  return withTempDir(async (dir) => {
    Deno.writeTextFileSync(
      join(dir, "one.bib"),
      `@article{alpha, title={Alpha one}, author={Smith, Alice}, year={2024}}
       @article{shared, title={Shared one}, author={Smith, Alice}, year={2024}}
       @article{Case, title={Case upper}, author={Smith, Alice}, year={2024}}`,
    );
    Deno.writeTextFileSync(
      join(dir, "two.bib"),
      `@article{shared, title={Shared two}, author={Jones, Bob}, year={2025}}
       @article{beta, title={Beta two}, author={Jones, Bob}, year={2025}}
       @article{case, title={Case lower}, author={Jones, Bob}, year={2025}}`,
    );
    Deno.writeTextFileSync(
      join(dir, "three.bib"),
      `@article{shared, title={Shared three}, author={Brown, Carol}, year={2026}}`,
    );
    const entries = await renderToCSLJSON(dir, biblios);
    return entries.map((entry) =>
      [entry.id, String(entry.title).toLowerCase()] as [string, string]
    );
  });
}

unitTest(
  "renderToCSLJSON - later bibliography file wins for a duplicate id",
  async () => {
    const entries = await cslEntries(["one.bib", "two.bib"]);
    assertEquals(
      entries.map(([id]) => id),
      ["alpha", "shared", "Case", "beta", "case"],
    );
    assertEquals(entries.find(([id]) => id === "shared")?.[1], "shared two");
  },
);

unitTest("renderToCSLJSON - last of three files wins", async () => {
  const entries = await cslEntries(["one.bib", "two.bib", "three.bib"]);
  assertEquals(entries.filter(([id]) => id === "shared"), [
    ["shared", "shared three"],
  ]);
});

unitTest("renderToCSLJSON - single file unchanged", async () => {
  const entries = await cslEntries(["one.bib"]);
  assertEquals(entries.map(([id]) => id), ["alpha", "shared", "Case"]);
});
