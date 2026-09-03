/*
 * axe-postrender.test.ts
 *
 * The one thing `quarto call axe` reads from its environment: whether it is a
 * project script running on a render that rebuilt only part of the site.
 *
 * The reader is injected rather than set on the process, because Deno runs
 * test files in parallel and `Deno.env.set` is global state (see
 * .claude/rules/testing/test-anti-patterns.md). The end-to-end wiring — that
 * axeScan actually consults this — is pinned in
 * tests/smoke/axe/axe-exit-codes.test.ts.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { isIncrementalProjectRender } from "../../src/command/call/axe/cmd.ts";

/** An env reader over a fixed map, so no process state is touched. */
function envOf(vars: Record<string, string>) {
  return (key: string) => vars[key];
}

unitTest(
  "post-render gate - a project script on an incremental render is skipped",
  // deno-lint-ignore require-await
  async () => {
    // Quarto sets OUTPUT_DIR for every pre/post-render script and adds
    // RENDER_ALL only when the render covered every file. A preview reload
    // looks the same as an incremental render here, and should also skip.
    assertEquals(
      isIncrementalProjectRender(envOf({
        QUARTO_PROJECT_OUTPUT_DIR: "/project/_site",
      })),
      true,
    );
  },
);

unitTest(
  "post-render gate - a full project render scans",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      isIncrementalProjectRender(envOf({
        QUARTO_PROJECT_OUTPUT_DIR: "/project/_site",
        QUARTO_PROJECT_RENDER_ALL: "1",
      })),
      false,
    );
  },
);

unitTest(
  "post-render gate - a plain command line scans",
  // deno-lint-ignore require-await
  async () => {
    // RENDER_ALL is absent here too, which is why the gate can't read it
    // alone: on its own it would make the command a no-op everywhere except
    // inside a full project render.
    assertEquals(isIncrementalProjectRender(envOf({})), false);
  },
);
