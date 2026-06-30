/*
 * clean-output-dir-decision.test.ts
 *
 * Unit tests for shouldCleanProjectOutputDir — the decision of whether
 * renderProject removes the project output directory before rendering.
 *
 * The decision must depend ONLY on the --clean flag and the project type
 * opting in via cleanOutputDir. It must NOT be influenced by options.forceClean
 * (which only governs .quarto scratch cleanup). forceClean wrongly forcing
 * output-dir cleaning is the #13623 data-loss bug.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { unitTest } from "../../test.ts";
import { shouldCleanProjectOutputDir } from "../../../src/command/render/project.ts";
import type { ProjectType } from "../../../src/project/types/types.ts";
import type { RenderOptions } from "../../../src/command/render/types.ts";

const projType = (cleanOutputDir?: boolean): ProjectType =>
  ({ type: "test", cleanOutputDir } as unknown as ProjectType);

const opts = (clean?: boolean, forceClean?: boolean): RenderOptions =>
  ({ flags: { clean }, forceClean } as unknown as RenderOptions);

interface Case {
  name: string;
  projType: ProjectType;
  options: RenderOptions;
  expected: boolean;
}

const cases: Case[] = [
  // website / book / manuscript: cleanOutputDir true + clean -> clean
  {
    name: "cleanOutputDir type with clean cleans",
    projType: projType(true),
    options: opts(true, false),
    expected: true,
  },
  // default project type: never cleans regardless of clean flag
  {
    name: "cleanOutputDir false never cleans",
    projType: projType(false),
    options: opts(true, false),
    expected: false,
  },
  {
    name: "cleanOutputDir undefined never cleans",
    projType: projType(undefined),
    options: opts(true, false),
    expected: false,
  },
  // --no-clean suppresses cleaning on a cleanOutputDir type
  {
    name: "clean=false suppresses cleaning",
    projType: projType(true),
    options: opts(false, false),
    expected: false,
  },
  // #13623 GUARD: forceClean must NOT force cleaning for a non-cleanOutputDir
  // type — this is exactly the synthetic single-file --output-dir case.
  {
    name: "forceClean does not clean default type (#13623)",
    projType: projType(false),
    options: opts(true, true),
    expected: false,
  },
  {
    name: "forceClean does not clean undefined cleanOutputDir (#13623)",
    projType: projType(undefined),
    options: opts(true, true),
    expected: false,
  },
  // forceClean is irrelevant: a cleanOutputDir type cleans because of
  // cleanOutputDir, not because of forceClean.
  {
    name: "cleanOutputDir type cleans irrespective of forceClean",
    projType: projType(true),
    options: opts(true, true),
    expected: true,
  },
];

for (const c of cases) {
  // deno-lint-ignore require-await
  unitTest(`shouldCleanProjectOutputDir - ${c.name}`, async () => {
    assertEquals(shouldCleanProjectOutputDir(c.projType, c.options), c.expected);
  });
}
