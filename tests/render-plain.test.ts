import { quarto } from "../src/quarto.ts";
import { verifyAndCleanOutput } from "./verify.ts";

Deno.test("Markdown Render", async () => {
  await quarto(["render", "docs/test-plain.md"]);
  verifyAndCleanOutput("docs/test-plain.html");
});
