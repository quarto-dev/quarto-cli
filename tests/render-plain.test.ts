import { testRender } from "./render.ts";

Deno.test("render: plain md", async () => {
  await testRender("docs/test-plain.md", true);
});
