import { quarto } from "../src/quarto.ts";
import { join } from "path/mod.ts";
import { verifyAndCleanOutput, verifyNoPath } from "./verify.ts";

const supportingFilesPath = "docs/test_files";

// Basic HTML rendering with a plot
Deno.test("Rmd Render", async () => {
  
  const plotOutputPath = join(
    supportingFilesPath,
    "figure-html/unnamed-chunk-1-1.png",
  );

  await quarto(["render", "docs/test.Rmd"]);

  verifyAndCleanOutput("docs/test.html");
  verifyAndCleanOutput(plotOutputPath);
  verifyAndCleanOutput(supportingFilesPath);
});

// Basic PDF rendering
Deno.test("Rmd Render", async () => {
  await quarto(["render", "docs/test.Rmd", "--to", "pdf"]);
  
  verifyAndCleanOutput("docs/test.pdf");
  verifyNoPath(supportingFilesPath);
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
  
  verifyAndCleanOutput("docs/test-params.html");
});
