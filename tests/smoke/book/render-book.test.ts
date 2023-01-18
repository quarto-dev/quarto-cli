import { testQuartoCmd } from "../../test.ts";
import { noErrorsOrWarnings } from "../../verify.ts";

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { docs } from "../../utils.ts";

const input = docs("books/simple");

// Run the command
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
