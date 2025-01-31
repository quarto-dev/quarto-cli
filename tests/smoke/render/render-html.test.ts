/*
* render-html.test.ts
*
* Copyright (C) 2024 Posit Software, PBC
*
*/

import { existsSync } from "../../../src/deno_ral/fs.ts";

import { testRender } from "./render.ts";
import { fileLoader } from "../../utils.ts";
import { join } from "path";
import { assert } from "testing/asserts";
import { isWindows } from "../../../src/deno_ral/platform.ts";

const testFile = fileLoader()("test.qmd", "html");

// Simple rendering tests
testRender(testFile.input, "html", false, [], {
  teardown: async () => {
    // Bootstrap files should be in the libs folder
    const bootstrapPath = join(testFile.output.supportPath, "libs", "bootstrap");
    assert(existsSync(bootstrapPath), `Expected ${bootstrapPath} to exist`);
    // Check that the bootstrap files have the correct mode
    // Related to #660, and #11532
    if (!isWindows) {
      const files = Deno.readDirSync(bootstrapPath);
      for (const file of files) {
        if (file.name.match(/bootstrap-.*\.min\.css$/)) {
          const fileInfo = Deno.statSync(join(bootstrapPath, file.name));
          assert(
            fileInfo.mode?.toString(8) === "100644", 
            `Expected file mode 100644, got ${fileInfo.mode?.toString(8)}`
          );
        }
      }
    }
  },
});