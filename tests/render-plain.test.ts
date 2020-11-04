import { quarto } from "../src/quarto.ts";

Deno.test("Markdown Render", async () => {
  await quarto(["render", "docs/test-plain.md"]);
});
