
// TODO: Intermediary test.exec.ipynb is hangout around after test completion

import { quarto } from "../src/quarto.ts";
import { verifyAndCleanOutput, verifyNoPath } from "./verify.ts";


const htmlOutput = "docs/test-jupyter.html";
const supportFilesPath = "docs/test-jupyter_files";

Deno.test("ipynb render", async () => {
  await quarto(["render", "docs/test-jupyter.ipynb"]);
  verifyAndCleanOutput(htmlOutput);
  verifyAndCleanOutput(supportFilesPath);
});

Deno.test("Jupyter Markdown Render", async () => {
  await quarto(["render", "docs/test-jupyter.md"]);
  verifyAndCleanOutput(htmlOutput);
  verifyAndCleanOutput(supportFilesPath);
});

Deno.test("Python Jupytext Render", async () => {
  await quarto(["render", "docs/test-jupyter.py"]);
  verifyAndCleanOutput(htmlOutput);
  verifyAndCleanOutput(supportFilesPath);
});

Deno.test("Python Markdown PDF Render", async () => {
  await quarto(["render", "docs/test-jupyter.md", "--to", "pdf"]);
  verifyAndCleanOutput("docs/test-jupyter.pdf");
  verifyNoPath(supportFilesPath);
});