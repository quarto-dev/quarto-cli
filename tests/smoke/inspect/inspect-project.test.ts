/*
 * inspect-project.test.ts
 *
 * Characterizes `quarto inspect` output for a project directory, for a file
 * inside a project, and the error for a directory that is not a project.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join, relative, resolve } from "../../../src/deno_ral/path.ts";
import { normalizePath } from "../../../src/core/path.ts";
import { ExecuteOutput, testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import { printsMessage } from "../../verify.ts";
import { assert, assertEquals } from "testing/asserts";

const projectDir = normalizePath(docs("inspect/project-basic"));
const kInputs = ["index.qmd", "sub/page.qmd"];

function relativeSorted(root: string, paths: string[]) {
  return paths
    .map((path) => relative(root, path).replaceAll("\\", "/"))
    .sort();
}

// deno-lint-ignore no-explicit-any
function assertProjectShape(project: any, root: string) {
  assertEquals(
    Object.keys(project).sort(),
    [
      "config",
      "dir",
      "engines",
      "extensions",
      "fileInformation",
      "files",
      "quarto",
    ],
  );
  assertEquals(project.dir, root);
  assertEquals(project.engines, ["markdown"]);
  assertEquals(project.config.project.type, "default");
  assertEquals(relativeSorted(root, project.files.input), kInputs);
  assertEquals(project.files.config, [join(root, "_quarto.yml")]);
  assertEquals(
    Object.keys(project.fileInformation)
      .map((key) => key.replaceAll("\\", "/"))
      .sort(),
    kInputs,
  );
}

(() => {
  const output = docs("inspect/project-basic.json");
  testQuartoCmd(
    "inspect",
    [projectDir, output],
    [
      {
        name: "inspect-project-dir",
        verify: async (_outputs: ExecuteOutput[]) => {
          assert(existsSync(output));
          const json = JSON.parse(Deno.readTextFileSync(output));
          assertProjectShape(json, projectDir);
        },
      },
    ],
    {
      teardown: async () => {
        if (existsSync(output)) {
          Deno.removeSync(output);
        }
      },
    },
  );
})();

(() => {
  const output = resolve(docs("inspect/project-basic-file.json"));
  const input = "page.qmd";
  testQuartoCmd(
    "inspect",
    [input, output],
    [
      {
        name: "inspect-file-in-project",
        verify: async (_outputs: ExecuteOutput[]) => {
          assert(existsSync(output));
          const json = JSON.parse(Deno.readTextFileSync(output));
          assertEquals(
            Object.keys(json).sort(),
            [
              "engines",
              "fileInformation",
              "formats",
              "project",
              "quarto",
              "resources",
            ],
          );
          assertEquals(json.engines, ["markdown"]);
          assertEquals(Object.keys(json.fileInformation), [input]);
          assertProjectShape(json.project, projectDir);
        },
      },
    ],
    {
      cwd: () => join(projectDir, "sub"),
      teardown: async () => {
        if (existsSync(output)) {
          Deno.removeSync(output);
        }
      },
    },
  );
})();

// A file inside the project dir but excluded from the project inputs is
// inspected as a standalone file: _quarto.yml does not apply to it.
(() => {
  const input = docs("inspect/project-basic/_drafts/draft.qmd");
  const output = docs("inspect/project-basic-draft.json");
  testQuartoCmd(
    "inspect",
    [input, output],
    [
      {
        name: "inspect-file-outside-project-inputs",
        verify: async (_outputs: ExecuteOutput[]) => {
          assert(existsSync(output));
          const json = JSON.parse(Deno.readTextFileSync(output));
          assertEquals(json.engines, ["markdown"]);
          assertEquals(Object.keys(json.fileInformation), [input]);
          assertEquals(json.project.dir, join(projectDir, "_drafts"));
          assertEquals(json.project.files, { input: [] });
          assertEquals(json.project.config.project, {});
          assertEquals(json.project.engines, []);
          assertEquals(json.project.fileInformation, {});
        },
      },
    ],
    {
      teardown: async () => {
        if (existsSync(output)) {
          Deno.removeSync(output);
        }
      },
    },
  );
})();

(() => {
  const input = docs("inspect/not-a-project");
  const output = docs("inspect/not-a-project.json");
  testQuartoCmd(
    "inspect",
    [input, output],
    [
      printsMessage({ level: "ERROR", regex: /is not a Quarto project\./ }),
      {
        name: "inspect-not-a-project-writes-nothing",
        verify: async (_outputs: ExecuteOutput[]) => {
          assert(!existsSync(output));
        },
      },
    ],
    {
      teardown: async () => {
        if (existsSync(output)) {
          Deno.removeSync(output);
        }
      },
    },
  );
})();
