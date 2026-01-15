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


test('KaTeX does not prevent crossref pop to be rendered', async ({ page }) => {
  await page.goto('html/math/katex/crossref-popup.html');
  const Thm1Ref = page.getByRole('link', { name: 'Theorem 1' });
  await expect(Thm1Ref).toBeVisible();
  await Thm1Ref.hover();
  // hover box should be visible
  await expect(page.getByRole('tooltip', { name: 'Theorem 1 (Theorem with math' })).toBeVisible();
  // Katex Math should be rendered in the hover box
  await expect(page.getByRole('tooltip', { name: 'Theorem 1 (Theorem with math' })).toContainText('∅');
})