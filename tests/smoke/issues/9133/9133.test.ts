import { runQuarto } from "../../../quarto-cmd.ts";
import { test } from "../../../test.ts";
if (Deno.build.os !== "windows") {
  test({
    name: "https://github.com/quarto-dev/quarto-cli/issues/9133",
    context: {
      setup: async () => {
        Deno.mkdirSync("smoke/issues/9133/oh'\"no", { recursive: true });
        Deno.copyFileSync("smoke/issues/9133/jl", "smoke/issues/9133/oh'\"no/jl.qmd");
        Deno.copyFileSync("smoke/issues/9133/py", "smoke/issues/9133/oh'\"no/py.qmd");

        // concurrent renders reproduce the original intra-process race;
        // in binary mode each render is a separate process, so the race
        // may not reproduce there. runQuarto supplies the 10-minute
        // timeout the explicit Promise.race used to provide, and failures
        // throw (no logFile: two concurrent children would interleave a
        // shared log file).
        await Promise.all([
          runQuarto(["render", "smoke/issues/9133/oh'\"no/jl.qmd"]),
          runQuarto(["render", "smoke/issues/9133/oh'\"no/py.qmd"]),
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
