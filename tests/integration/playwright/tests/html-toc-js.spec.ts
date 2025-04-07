import { expect, Page, test } from "@playwright/test";

const testPages = {
  'posts': 'table.html',
};

test("toc navigation doesn't crash", async ({ page }) => {
  const messages: string[] = [];
  page.on('pageerror', (error) => {
    messages.push(`[${error.name}] ${error.message}`);
  });
  await page.goto('./blog/simple-blog/_site/posts/post-with-code/index.html');
  expect(messages).toStrictEqual([]); 
});
