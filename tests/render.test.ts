import {
  assertEquals,
} from "https://deno.land/std/testing/asserts.ts";
import { render } from "../src/command/render.ts";

Deno.test("Simple Markdown Render", async () => {
  const result = await render("./docs/test-plain.md");
  assertEquals(result.code, 0);
});

Deno.test("Python Notebook Render", async () => {
  const result = await render("./docs/test.ipynb");
  assertEquals(result.code, 0);
});

Deno.test("R Markdown Render", async () => {
  const result = await render("./docs/test.Rmd");
  assertEquals(result.code, 0);
});
