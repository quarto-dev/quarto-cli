/*
 * cap-location-completions.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "../../asserts.ts";

import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../../src/core/lib/yaml-validation/state.ts";
import {
  CompletionResult,
  getAutomation,
} from "../../../src/core/lib/yaml-intelligence/yaml-intelligence.ts";

async function fullInit() {
  await initYamlIntelligenceResourcesFromFilesystem();
}

// `margin` is only laid out in HTML documents, LaTeX/PDF and Typst, so the
// other formats are not offered it. `top` and `bottom` work everywhere.
const cases: [string, string[]][] = [
  ["html", ["top", "bottom", "margin"]],
  ["pdf", ["top", "bottom", "margin"]],
  ["typst", ["top", "bottom", "margin"]],
  ["revealjs", ["top", "bottom"]],
  ["dashboard", ["top", "bottom"]],
  ["beamer", ["top", "bottom"]],
];

for (const option of ["cap-location", "fig-cap-location", "tbl-cap-location"]) {
  for (const [format, expected] of cases) {
    unitTest(`${option} completions for ${format}`, async () => {
      setInitializer(fullInit);
      await initState();

      const line = `${option}: `;
      const result = await getAutomation("completions", {
        path: "doc.qmd",
        filetype: "markdown",
        embedded: false,
        formats: [format],
        project_formats: [],
        engine: "markdown",
        line,
        code: `---\ntitle: t\nformat: ${format}\n${line}\n---\n`,
        position: { row: 3, column: line.length },
        explicit: true,
      }) as CompletionResult;

      assertEquals(
        result.completions.map((c) => c.value).sort(),
        [...expected].sort(),
        `${format}: ${option}`,
      );
    });
  }
}
