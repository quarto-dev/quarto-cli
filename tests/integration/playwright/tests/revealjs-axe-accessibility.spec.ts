import { test, expect } from '@playwright/test';

test('Revealjs - axe detects contrast violation and shows report', async ({ page }) => {
  await page.goto('/revealjs/axe-accessibility.html', { waitUntil: 'networkidle' });

  // Wait for axe to run and produce report (output: document mode)
  const axeReport = page.locator('.quarto-axe-report');
  await expect(axeReport).toBeVisible({ timeout: 10000 });

  // Verify report contains violation information
  const reportText = await axeReport.textContent();
  expect(reportText).toContain('color contrast');
});
