/*
 * check-project-config-only.test.ts
 *
 * `quarto check` inside a project reads the project configuration only: it
 * does not walk the project input files, nor create the project .quarto dir.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { testQuartoCmdJson } from "../../test.ts";
import {
  canMakeUnreadableDir,
  makeUnreadableDir,
  removeProject,
  tempProject,
} from "../../utils.ts";
import { assert, assertEquals } from "testing/asserts";

// Not registered when the dir can't be made unreadable: an ignored test never
// runs its teardown, so its fixture would be left behind.
if (canMakeUnreadableDir) {
  const projectDir = tempProject("quarto-check-project");
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
}

(() => {
  const projectDir = tempProject("quarto-check-project");
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
