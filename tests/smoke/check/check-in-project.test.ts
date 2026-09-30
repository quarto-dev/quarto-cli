/*
 * check-in-project.test.ts
 *
 * Characterizes `quarto check` run from a subdirectory of a project: the JSON
 * result shape, and discovery of an external engine declared in _quarto.yml.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join, resolve } from "../../../src/deno_ral/path.ts";
import { ExecuteOutput, testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import { assert, assertEquals } from "testing/asserts";

const projectDir = resolve(docs("check/project-external-engine"));
const cwd = () => join(projectDir, "sub");

(() => {
  const output = join(projectDir, "check-info.json");
  testQuartoCmd(
    "check",
    ["info", "--output", output],
    [
      {
        name: "check-info-json-in-project",
        verify: async (_outputs: ExecuteOutput[]) => {
          const json = JSON.parse(Deno.readTextFileSync(output));
          assertEquals(Object.keys(json).sort(), ["info", "strict", "version"]);
          assertEquals(json.strict, true);
          assertEquals(Object.keys(json.info), ["cacheDir"]);
          assert(typeof json.info.cacheDir === "string");
        },
      },
    ],
    {
      cwd,
      teardown: async () => {
        if (existsSync(output)) {
          Deno.removeSync(output);
        }
      },
    },
  );
})();

(() => {
  const output = join(projectDir, "check-probe.json");
  testQuartoCmd(
    "check",
    ["check-probe", "--output", output],
    [
      {
        name: "check-discovers-project-external-engine",
        verify: async (_outputs: ExecuteOutput[]) => {
          const json = JSON.parse(Deno.readTextFileSync(output));
          assertEquals(json["check-probe"], { discovered: true });
        },
      },
    ],
    {
      cwd,
      teardown: async () => {
        if (existsSync(output)) {
          Deno.removeSync(output);
        }
      },
    },
  );
})();
