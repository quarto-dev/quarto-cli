import { testRender } from "./render.ts";

Deno.test("ipynb render (paired)", async () => {
  await testRender("docs/test-jupyter.ipynb");
});

Deno.test("Jupyter Markdown Render (paired)", async () => {
  await testRender("docs/test-jupyter.md");
});

Deno.test("Python Jupytext Render (paired)", async () => {
  await testRender("docs/test-jupyter.py");
});

Deno.test("Python Markdown PDF Render (paired)", async () => {
  await testRender("docs/test-jupyter.md", false, "pdf");
});

Deno.test("ipynb render (unpaired)", async () => {
  await testRender("docs/unpaired.ipynb");
});

Deno.test("md render (unpaired)", async () => {
  await testRender("docs/unpaired-md.md");
});

Deno.test("py render (unpaired)", async () => {
  await testRender("docs/unpaired-py.py");
});
