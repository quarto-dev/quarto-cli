import { verifyAndCleanOutput } from "./verify.ts";
import { testRender } from "./render.ts";

// Basic HTML rendering with a plot
Deno.test("render: Rmd\n", async () => {
  await testRender("docs/test.Rmd", true, "html", [], () => {
    verifyAndCleanOutput("docs/test_files/figure-html/unnamed-chunk-2-1.png");
  });
});

// Basic PDF rendering
Deno.test("render: Rmd to pdf", async () => {
  await testRender("docs/test.Rmd", false, "pdf");
});

// Params rendering
Deno.test("render: Rmd (with params)", async () => {
  await testRender(
    "docs/test.Rmd",
    true,
    "html",
    ["--execute-params", "docs/params.yml"],
  );
});
