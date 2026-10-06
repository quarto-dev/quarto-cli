/*
* fmtutil-handler.test.ts
*
* Copyright (C) 2026 Posit Software, PBC
*
*/

import { fmtutilFailureMessage } from "../../../src/command/render/latexmk/texlive.ts";
import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";

// deno-lint-ignore require-await
unitTest("fmtutilFailureMessage - undefined when fmtutil-sys succeeded", async () => {
  assertEquals(
    fmtutilFailureMessage({ code: 0, success: true, stdout: "", stderr: "" }),
    undefined,
  );
});

// deno-lint-ignore require-await
unitTest("fmtutilFailureMessage - warning text when exit code is non-zero", async () => {
  const msg = fmtutilFailureMessage({
    code: 1,
    success: false,
    stdout: "",
    stderr: "fmtutil: error rebuilding format luatex",
  });
  assert(msg, "expected a warning message");
  assert(msg.includes("fmtutil-sys --all"), "should mention the command");
  assert(msg.includes("non-fatal"), "should signal non-fatal");
  assert(msg.includes("fmtutil: error rebuilding format luatex"), "should include stderr");
});

// deno-lint-ignore require-await
unitTest("fmtutilFailureMessage - omits stderr suffix when stderr is empty/whitespace", async () => {
  const msg = fmtutilFailureMessage({
    code: 1,
    success: false,
    stdout: "",
    stderr: "   \n",
  });
  const baseMsg =
    `Failed to rebuild format tree (\`fmtutil-sys --all\` exited 1). This is non-fatal — package installation will continue.`;
  assertEquals(msg, baseMsg);
});
