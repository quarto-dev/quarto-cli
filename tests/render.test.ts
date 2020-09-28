import { render } from "../src/command/render.ts";

Deno.test("Simple Markdown Render", async () => {
  await render("./docs/test-plain.md");
});

Deno.test("Python Notebook Render", async () => {
  await render("./docs/test.ipynb");
});

Deno.test("R Markdown Render", async () => {
  await render("./docs/test.Rmd");
});
