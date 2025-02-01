import { expect, Page, test } from "@playwright/test";

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
