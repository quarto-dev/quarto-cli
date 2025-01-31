import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrorsOrWarnings } from "../../verify.ts";

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";

// Test a simple book
const input = docs("search/issue-10285");

testQuartoCmd(
  "render",
  [input],
  [noErrorsOrWarnings],
  {
    teardown: async () => {
      const bookDir = join(input, "_book");
      if (existsSync(bookDir)) {
        await Deno.remove(bookDir, { recursive: true });
      }
    },
  },
);
