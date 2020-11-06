import { testRender } from "./render.ts";

Deno.test("render: ipynb (paired)", async () => {
  await testRender("docs/test-jupyter.ipynb");
});

Deno.test("render: jupytext md (paired)", async () => {
  await testRender("docs/test-jupyter.md");
});

Deno.test("render: py file (paired)", async () => {
  await testRender("docs/test-jupyter.py");
});

Deno.test("render: jupytext md to pdf", async () => {
  await testRender("docs/test-jupyter.md", false, "pdf");
});

Deno.test("render: ipynb (unpaired)", async () => {
  await testRender("docs/unpaired.ipynb");
});

Deno.test("render: jupytext md (unpaired)", async () => {
  await testRender("docs/unpaired-md.md");
});

Deno.test("render: py file (unpaired)", async () => {
  await testRender("docs/unpaired-py.py");
});
