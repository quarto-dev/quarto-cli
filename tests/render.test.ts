import { render } from "../src/command/render.ts";
import { quarto } from "../src/quarto/quarto.ts";

Deno.test("Simple Markdown Render", async () => {
  await quarto(["render", "docs/test-plain.md"]);
});

Deno.test("Python Notebook Render", async () => {
  await quarto(["render", "docs/test.Rmd"]);
});

Deno.test("R Markdown Render", async () => {
  await quarto(["render", "docs/test.ipynb"]);
});
