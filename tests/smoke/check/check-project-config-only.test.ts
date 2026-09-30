/*
 * check-project-config-only.test.ts
 *
 * `quarto check` inside a project reads the project configuration only: it
 * does not walk the project input files, nor create the project .quarto dir.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { dirname, join } from "../../../src/deno_ral/path.ts";
import { testQuartoCmdJson } from "../../test.ts";
import { canMakeUnreadableDir, makeUnreadableDir } from "../../utils.ts";
import { assert, assertEquals } from "testing/asserts";

// The tree must exist at registration: the harness enters `cwd` before setup.
function tempProject(): string {
  const dir = Deno.makeTempDirSync({ prefix: "quarto-check-project" });
  Deno.writeTextFileSync(join(dir, "_quarto.yml"), "project:\n  type: website\n");
  Deno.mkdirSync(join(dir, "sub"));
  Deno.writeTextFileSync(join(dir, "sub", "index.qmd"), "# Hello\n");
  return dir;
}

// Teardown runs before the harness restores cwd, and Windows cannot remove
// the process cwd, so leave the project first.
function removeProject(dir: string) {
  Deno.chdir(dirname(dir));
  Deno.removeSync(dir, { recursive: true });
  return Promise.resolve();
}

(() => {
  const projectDir = tempProject();
  const locked = join(projectDir, "locked");
  Deno.mkdirSync(locked);
  Deno.writeTextFileSync(join(locked, "doc.qmd"), "# Locked\n");
  const output = join(projectDir, "check-info.json");
  let restore: (() => void) | undefined;
  testQuartoCmdJson(
    "check",
    ["info", "--output", output],
    output,
    "check-in-project-with-unreadable-dir",
    (json) => {
      assertEquals(json.strict, true);
    },
    {
      ignore: !canMakeUnreadableDir,
      cwd: () => join(projectDir, "sub"),
      setup: () => {
        restore = makeUnreadableDir(locked);
        return Promise.resolve();
      },
      teardown: () => {
        restore?.();
        return removeProject(projectDir);
      },
    },
  );
})();

(() => {
  const projectDir = tempProject();
  const output = join(projectDir, "check-info.json");
  testQuartoCmdJson(
    "check",
    ["info", "--output", output],
    output,
    "check-in-project-creates-no-project-cache",
    (_json) => {
      assert(
        !existsSync(join(projectDir, ".quarto")),
        "quarto check created the project .quarto dir",
      );
    },
    {
      cwd: () => join(projectDir, "sub"),
      teardown: () => removeProject(projectDir),
    },
  );
})();
