import { quarto } from "../src/quarto.ts";
import { verifyAndCleanOutput } from "./verify.ts";

Deno.test("ipynb render", async () => {
  await quarto(["render", "docs/test-jupyter.ipynb"]);
  verifyAndCleanOutput("docs/test-jupyter.html");
});

Deno.test("Jupyter Markdown Render", async () => {
  await quarto(["render", "docs/test-jupyter.md"]);
  verifyAndCleanOutput("docs/test-jupyter.html");
});

Deno.test("Python Jupytext Render", async () => {
  await quarto(["render", "docs/test-jupyter.py"]);
  verifyAndCleanOutput("docs/test-jupyter.html");
});

Deno.test("Python Markdown PDF Render", async () => {
  await quarto(["render", "docs/test-jupyter.md", "--to", "pdf"]);
  verifyAndCleanOutput("docs/test-jupyter.pdf");
});