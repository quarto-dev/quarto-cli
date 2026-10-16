/*
 * front-matter-image-keys.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 */

import { unitTest } from "../../test.ts";

import { assert } from "testing/asserts";

import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../../src/core/lib/yaml-validation/state.ts";
import {
  CompletionResult,
  getAutomation,
} from "../../../src/core/lib/yaml-intelligence/yaml-intelligence.ts";

// Loads only the generated artifact (no overlay of the source schema yml), so
// these tests fail if `dev-call build-artifacts` was not re-run.
async function frontMatterCompletions(line: string) {
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();
  const code = `---\ntitle: foo\n${line}\n---\n\nSome text.\n`;
  const result = await getAutomation("completions", {
    path: null,
    filetype: "markdown",
    embedded: false,
    formats: ["html"],
    project_formats: [],
    engine: "markdown",
    line,
    code,
    position: { row: 2, column: line.length },
  }) as CompletionResult | null;
  assert(result !== null);
  return result.completions.map((c) => c.value);
}

unitTest("front matter completions - offer image-alt", async () => {
  const values = await frontMatterCompletions("image-a");
  assert(values.includes("image-alt: "), `got: ${values.join(", ")}`);
});

// image-title is read from the page metadata by about pages
// (src/project/types/website/about/website-about.ts).
unitTest("front matter completions - offer image-title", async () => {
  const values = await frontMatterCompletions("image-t");
  assert(values.includes("image-title: "), `got: ${values.join(", ")}`);
});
