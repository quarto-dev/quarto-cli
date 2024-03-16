/*
* parse-error.test.ts
*
* Copyright (C) 2023 Posit Software, PBC
*
*/

import { findMissingFontsAndPackages } from "../../../src/command/render/latexmk/parse-error.ts"
import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts.ts";

unitTest("findMissingPackages", async () => {
  const logText = Deno.readTextFileSync("expl3-aborted.log")
  assert(findMissingFontsAndPackages(logText, ".")[0] === "expl3.sty" );
}, {
  cwd: () => "unit/latexmk/"
});
