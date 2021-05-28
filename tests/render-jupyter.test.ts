import { testRender } from "./render.ts";

Deno.test("render: jupyter md to pdf", async () => {
  await testRender("docs/test-jupyter.md", false, "pdf");
});

Deno.test("render: ipynb", async () => {
  await testRender("docs/unpaired.ipynb");
});

Deno.test("render: jupyter md", async () => {
  await testRender("docs/unpaired-md.md");
});
