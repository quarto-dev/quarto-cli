import { quarto } from "../src/quarto/quarto.ts";

/*
Deno.test("Simple Markdown Render", async () => {
  await quarto(["render", "docs/test-plain.md"]);
});
*/

Deno.test("Rmd Render", async () => {
  await quarto(["render", "docs/test.Rmd"]);
});

Deno.test("ipynb render", async () => {
  await quarto(["render", "docs/test.ipynb"]);
});
