import { test, expect } from '@playwright/test';

test('logo and footer are correctly shown', async ({ page }) => {
  await page.goto('./revealjs/logo-footer.html#/slide-1');
  await expect(page.locator('.reveal > .footer.footer-default')).toContainText('Footer text');
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
  await page.keyboard.press('ArrowRight'); // Next slide
  await expect(page.locator('.reveal > .footer.footer-default')).toContainText('Footer text');
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
  await page.keyboard.press('ArrowRight'); // Next slide
  await expect(page.locator('.reveal > .footer')).toBeHidden();
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
  await page.keyboard.press('ArrowRight'); // Next slide
  await expect(page.locator('.reveal > .footer.footer-default')).toBeHidden();
  await expect(page.locator('.reveal > .footer:not(.footer-default)')).toContainText('A different footer');
  await expect(page.locator('.slide-logo')).toHaveAttribute("src", "quarto.png");
});

test('internal id for links between slides are working', async ({ page }) => {
  await page.goto('./revealjs/links-id.html#/link-to-the-figure');
  await page.getByRole('link', { name: 'Figure Element' }).click();
  await page.waitForURL(/quarto-figure$/);
  await page.goto('./revealjs/links-id.html#/link-to-the-image');
  await page.getByRole('link', { name: 'Figure Element' }).click();
  await page.waitForURL(/image$/);
  await page.goto('./revealjs/links-id.html#/link-to-equation');
  await page.getByRole('link', { name: 'Equation' }).click();
  await page.waitForURL(/equation$/);
  await page.goto('./revealjs/links-id.html#/link-to-theorem');
  await page.getByRole('link', { name: 'Theorem' }).click();
  await page.waitForURL(/theorem$/);
});