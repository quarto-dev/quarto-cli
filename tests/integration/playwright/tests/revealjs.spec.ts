import { test, expect } from '@playwright/test';

test('logo and footer are correctly shown in default mode', async ({ page }) => {
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

test('logo and footer are correctly shown in scroll mode', async ({ page }) => {
  // check scroll mode too
  await page.goto('revealjs/logo-footer.html?view=scroll');
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