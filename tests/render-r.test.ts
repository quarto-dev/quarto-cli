import { quarto } from "../src/quarto.ts";
import { existsSync } from "fs/exists.ts";
import { assert } from "testing/asserts.ts";
import { join } from "path/mod.ts";

const supportingFilesPath = "docs/test_files";
const plotOutputPath = join(
  supportingFilesPath,
  "figure-html/unnamed-chunk-1-1.png",
);

// Basic HTML rendering with a plot
Deno.test("Rmd Render", async () => {
  await quarto(["render", "docs/test.Rmd"]);

  // Verify and cleanup plot files
  const plotExists = existsSync(plotOutputPath);
  assert(plotExists, "Failed to create plot at expected location");
  if (plotExists) {
    Deno.removeSync(supportingFilesPath, { recursive: true });
  }

  verifyAndCleanOutput("docs/test.html");
});

// Basic PDF rendering
Deno.test("Rmd Render", async () => {
  await quarto(["render", "docs/test.Rmd", "--to", "pdf"]);
  verifyAndCleanOutput("docs/test.pdf");
});

// Basic script rendering
Deno.test("R Script Render", async () => {
  await quarto(["render", "docs/test.R"]);
  verifyAndCleanOutput("docs/test.html");
});

// Params rendering
Deno.test("Rmd with Params", async () => {
  await quarto(
    ["render", "docs/test-params.Rmd", "--execute-params", "params.yml"],
  );
});

function verifyAndCleanOutput(output: string) {
  const ouptputExists = existsSync(output);
  assert(ouptputExists, "Failed to create output at expected location");
  if (ouptputExists) {
    Deno.removeSync(output);
  }
}
