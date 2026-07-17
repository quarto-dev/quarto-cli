import { runQuarto } from "../../quarto-cmd.ts";
import { test } from "../../test.ts";

test({
  name: "https://github.com/quarto-dev/quarto-cli/issues/11068",
  context: {
    setup: async() => {
      // only asserts the render to stdout succeeds (failure throws); in
      // binary mode the child's stdout is drained and discarded
      await runQuarto(["render", "docs/self-contained/simple.qmd", "-o", "-"]);
    }
  },
  execute: async () => {},
  verify: [],
  type: "smoke"
});
