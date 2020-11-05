import { quarto } from "../src/quarto.ts";
import { join } from "path/mod.ts";
import { verifyAndCleanOutput, verifyNoPath } from "./verify.ts";
import { testRender } from "./render.ts";

const supportingFilesPath = "docs/test_files";

// Basic HTML rendering with a plot
Deno.test("Rmd Render", async () => {
  await testRender("docs/test.Rmd", true, "html", [], () => {
    verifyAndCleanOutput("docs/test_files/figure-html/unnamed-chunk-1-1.png");
  });
});

// Basic PDF rendering
Deno.test("Rmd Render", async () => {
  await testRender("docs/test.Rmd", false, "pdf");
});

// Basic script rendering
Deno.test("R Script Render", async () => {
  await testRender("docs/test.R");
});

// Params rendering
Deno.test("Rmd with Params", async () => {
  await testRender(
    "docs/test.R",
    true,
    "html",
    ["--execute-params", "params.yml"],
  );
});
