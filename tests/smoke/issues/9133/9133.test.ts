import { quarto } from "../../../../src/quarto.ts";
import { test } from "../../../test.ts";
if (Deno.build.os !== "windows") {
  test({
    name: "https://github.com/quarto-dev/quarto-cli/issues/9133", 
    context: {
      setup: async () => {
        Deno.mkdirSync("smoke/issues/9133/oh'\"no", { recursive: true });
        Deno.copyFileSync("smoke/issues/9133/jl", "smoke/issues/9133/oh'\"no/jl.qmd");
        Deno.copyFileSync("smoke/issues/9133/py", "smoke/issues/9133/oh'\"no/py.qmd");

        const timeout = new Promise((_resolve, reject) => {
          setTimeout(reject, 600000, "timed out after 10 minutes");
        });
        await Promise.race([
          Promise.all([
            quarto(["render", "smoke/issues/9133/oh'\"no/jl.qmd"]),
            quarto(["render", "smoke/issues/9133/oh'\"no/py.qmd"]),  
          ]),
          timeout,
        ]);
      }
    },
    execute: async () => {
      Deno.removeSync("smoke/issues/9133/oh'\"no", { recursive: true });
    },
    verify: [],
    type: "smoke"
  });
}
