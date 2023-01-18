import { testQuartoCmd } from "../../test.ts";
import { noErrorsOrWarnings } from "../../verify.ts";

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { docs } from "../../utils.ts";

// Test a simple book
const input = docs("books/simple");
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

// Test a more complex book render
const vizInput = docs("books/visualization-curriculum");
testQuartoCmd(
  "render",
  [vizInput],
  [noErrorsOrWarnings],
  {
    teardown: async () => {
      const bookDir = join(vizInput, "docs");
      if (existsSync(bookDir)) {
        await Deno.remove(bookDir, { recursive: true });
      }
    },
  },
);
