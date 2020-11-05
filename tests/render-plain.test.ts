import { testRender } from "./render.ts";

Deno.test("Markdown Render", async () => {
  await testRender("docs/test-plain.md", false);
});
