import { test, expect } from '@playwright/test';

test.describe('KaTeX math rendering in Jupyter engine document', () => {
  const testCases = [
    { url: 'html/math/katex/not-embed.html', description: 'not embedding resources' },
    { url: 'html/math/katex/embed-with-math.html', description: 'embedding resources including Math' },
    { url: 'html/math/katex/embed-except-math.html', description: 'embedding resources except Math' }
  ];
  
  for (const { url, description } of testCases) {
    test(`KaTeX math is rendered while ${description}`, async ({ page }) => {
      await page.goto(url);
      // Check that math is rendered
      await expect(page.locator("span.katex")).toContainText('α');
    });
  }
});
