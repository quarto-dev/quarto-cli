/*
* yaml-cr-line-endings.test.ts
*
* Test YAML validation with CR-only line endings (old Mac format)
* See: https://github.com/quarto-dev/quarto-cli/issues/13998
*
* Copyright (C) 2025 Posit Software, PBC
*/

import { testRender } from "../render/render.ts";
import { noErrorsOrWarnings } from "../../verify.ts";
import { join } from "../../../src/deno_ral/path.ts";

// Create test file with CR-only line endings programmatically
const dir = Deno.makeTempDirSync({ prefix: "quarto-cr-test-" });
const crContent = "---\rtitle: \"CR Test\"\rauthor: \"Test Author\"\r---\r\rContent here.\r";
const inputFile = join(dir, "cr-only.qmd");
Deno.writeFileSync(inputFile, new TextEncoder().encode(crContent));

testRender(inputFile, "html", false, [noErrorsOrWarnings], {
  teardown: async () => {
    Deno.removeSync(dir, { recursive: true });
  },
});
