import { assertRejects } from "testing/asserts";
import { quarto } from "../../../src/quarto.ts";
import { test } from "../../test.ts";

test(
  {
    name: "invalid engines option errors",
    execute: async () => {
      assertRejects(
        async () => {await quarto(["render", "docs/engine/invalid-project/notebook.qmd"])},
        Error,
        "'invalid-engine' was specified in the list of engines in the project settings but it is not a valid engine",
      )
      },
    type: "smoke",
    context: {},
    verify: [],
  }
)