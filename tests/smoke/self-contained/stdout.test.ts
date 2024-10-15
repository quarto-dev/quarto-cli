import { quarto } from "../../../src/quarto.ts";
import { test } from "../../test.ts";

test({
  name: "https://github.com/quarto-dev/quarto-cli/issues/11068",
  context: {
    setup: async() => {
      await quarto(["render", "docs/self-contained/simple.qmd", "-o", "-"]);
    }
  },
  execute: async () => {},
  verify: [],
  type: "smoke"
});
