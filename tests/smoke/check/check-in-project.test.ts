/*
 * check-in-project.test.ts
 *
 * Characterizes `quarto check` run from a subdirectory of a project: the JSON
 * result shape, and discovery of an external engine declared in _quarto.yml.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join, resolve } from "../../../src/deno_ral/path.ts";
import { testQuartoCmdJson } from "../../test.ts";
import { docs } from "../../utils.ts";
import { assert, assertEquals } from "testing/asserts";

const projectDir = resolve(docs("check/project-external-engine"));
const cwd = () => join(projectDir, "sub");

(() => {
  const output = join(projectDir, "check-info.json");
  testQuartoCmdJson(
    "check",
    ["info", "--output", output],
    output,
    "check-info-json-in-project",
    (json) => {
      assertEquals(Object.keys(json).sort(), ["info", "strict", "version"]);
      assertEquals(json.strict, true);
      assertEquals(Object.keys(json.info), ["cacheDir", "project"]);
      assert(typeof json.info.cacheDir === "string");
    },
    { cwd },
  );
})();

(() => {
  const output = join(projectDir, "check-probe.json");
  testQuartoCmdJson(
    "check",
    ["check-probe", "--output", output],
    output,
    "check-discovers-project-external-engine",
    (json) => {
      assertEquals(json["check-probe"], { discovered: true });
    },
    { cwd },
  );
})();
