import { expect, Page, test } from "@playwright/test";

// To run this test standalone, first render the fixture with --output-dir:
//   quarto render tests/docs/playwright/embed-resources/issue-11860/main.qmd --output-dir=inner
// Then run:
//   npx playwright test tests/html-embed-resources-es6-modules.spec.ts
//
// The full test suite (integration/playwright-tests.test.ts) handles rendering automatically.
test("es6 modules to be bundled correctly in documents with embed-resources=true", async ({ page }) => {
  const messages: string[] = [];
  page.on('response', (response) => {
    if (!response.ok()) {
      messages.push(`[${response.status()}] ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => {
    messages.push(`[${error.name}] ${error.message}`);
  });
  await page.goto('./embed-resources/issue-11860/inner/main.html');
  expect(messages).toStrictEqual([]); 
});
