/*
 * project-unreadable-dir.test.ts
 *
 * A project containing a directory the user cannot list: `quarto render`
 * reports a framed error naming the directory, the project root and its
 * _quarto.yml, while `quarto inspect` keeps reporting the raw error.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "../../../src/deno_ral/path.ts";
import { normalizePath } from "../../../src/core/path.ts";
import { ExecuteOutput, testQuartoCmd, Verify } from "../../test.ts";
import {
  canMakeUnreadableDir,
  makeUnreadableDir,
  removeProject,
  tempProject,
} from "../../utils.ts";
import { assert, assertEquals } from "testing/asserts";

function errorMessages(outputs: ExecuteOutput[]) {
  return outputs.filter((output) => output.levelName === "ERROR")
    .map((output) => output.msg);
}

// Lines of the error message, without colors or tidyverse bullets. Dev builds
// run with QUARTO_DEBUG, which appends a stack trace to every error; the
// framed error's own printStack is pinned in the projectContext unit test.
function plainLines(msg: string) {
  // deno-lint-ignore no-control-regex
  return msg.replace(/\x1b\[[0-9;]*m/g, "").split("\n\nStack trace:")[0]
    .split("\n")
    .map((line) => line.replace(/^[✖xℹi] /, ""));
}

function registerUnreadableDirTest(
  cmd: string,
  name: string,
  verify: (root: string, locked: string) => Verify,
) {
  const root = normalizePath(tempProject("quarto-unreadable-project"));
  const locked = join(root, "locked");
  Deno.mkdirSync(locked);
  Deno.writeTextFileSync(join(locked, "doc.qmd"), "# Locked\n");
  let restore: (() => void) | undefined;
  testQuartoCmd(cmd, ["index.qmd"], [verify(root, locked)], {
    cwd: () => join(root, "sub"),
    setup: () => {
      restore = makeUnreadableDir(locked);
      return Promise.resolve();
    },
    teardown: () => {
      restore?.();
      return removeProject(root);
    },
  }, name);
}

// Not registered when the dir can't be made unreadable: an ignored test never
// runs its teardown, so its fixture would be left behind.
if (canMakeUnreadableDir) {
  registerUnreadableDirTest(
    "render",
    "render-in-project-with-unreadable-dir",
    (root, locked) => ({
      name: "framed permission error",
      verify: (outputs) => {
        const errors = errorMessages(outputs);
        assertEquals(errors.length, 1, `expected one error, got ${errors}`);
        const lines = plainLines(errors[0]);
        assertEquals(lines.length, 5, `unexpected message:\n${errors[0]}`);
        assertEquals(
          lines[0],
          "Could not read a directory while looking for project input files.",
        );
        assert(
          lines[1].endsWith(`readdir '${locked}'`),
          `expected the Deno readdir message, got: ${lines[1]}`,
        );
        assertEquals(lines.slice(2), [
          `Project root: ${root}`,
          `Set by: ${join(root, "_quarto.yml")}`,
          "If this _quarto.yml was created by accident, remove it. Otherwise make the directory readable.",
        ]);
        return Promise.resolve();
      },
    }),
  );

  registerUnreadableDirTest(
    "inspect",
    "inspect-in-project-with-unreadable-dir",
    (_root, locked) => ({
      name: "raw permission error",
      verify: (outputs) => {
        const errors = errorMessages(outputs);
        assertEquals(errors.length, 1, `expected one error, got ${errors}`);
        const [first] = errors[0].split("\n");
        assert(
          first.startsWith("PermissionDenied: ") &&
            first.endsWith(`readdir '${locked}'`),
          `expected the raw PermissionDenied error, got: ${first}`,
        );
        assert(
          errors[0].includes("Stack trace:"),
          "expected the raw error with its stack trace",
        );
        return Promise.resolve();
      },
    }),
  );
}
