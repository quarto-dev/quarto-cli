import { expect, test } from "@playwright/test";
import assert from "node:assert";

import { getUrl, ojsRuns, ojsVal } from "../src/utils.js";

test("page without ojs cell has no ojs runtime", async ({ page }) => {
  console.log(getUrl("ojs/test-no-ojs.html"));
  await page.goto(getUrl("ojs/test-no-ojs.html"), { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    return (window._ojs === undefined);
  });
  assert(result === true, `Expected true, got false instead`);
});

// testRender("docs/ojs/test-no-ojs.qmd", "html", true, [
//   {
//     name: "OJS runtime is absent",
//     verify: async (_output: ExecuteOutput[]) => {
//       const url = localFileURL("docs/ojs/test-no-ojs.qmd");
//       const result = await inPuppeteer(url, () => {
//         return (window._ojs === undefined);
//       });
//       assert(result === true, `Expected true, got false instead`);
//     },
//   },
// ]);

// testRender("docs/ojs/test-ojs-es-modules.qmd", "html", true, [
//   {
//     name: "OJS runtime is absent",
//     verify: async (_output: ExecuteOutput[]) => {
//       const url = localFileURL("docs/ojs/test-ojs-es-modules.qmd");
//       const result = await inPuppeteer(url, () => {
//         return (window._ojs !== undefined);
//       });
//       assert(result === true, `Expected true, got false instead`);
//     },
//   },
// ]);
