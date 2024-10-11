import { test, expect, Page } from '@playwright/test';

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

async function expectScrollViewMode(page: Page, isActive: boolean) {
  expect(await page.evaluate(() => (window as any).Reveal.isScrollView())).toBe(isActive);
  if (isActive) {
    await expect(page.locator('.scrollbar-playhead')).toBeVisible();
  } else {
    await expect(page.locator('.scrollbar-playhead')).toBeHidden();
  }
}

async function clickScrollViewMenuButton(page: Page) {
  await page.locator('div.slide-menu-button').click();
  await page.locator('li').filter({ hasText: 'Tools' }).click();
  expect(page.locator('li').filter({ hasText: 'Scroll View Mode' })).toBeVisible();
  await page.getByRole('link', { name: 'r Scroll View Mode' }).click();
}

test('scroll view mode is correctly activated with menu and shortcut', async ({ page }) => {
  await page.goto('revealjs/scroll-view-activate.html');
  // should be activated by default
  await expectScrollViewMode(page, true);
  // deactivate
  await clickScrollViewMenuButton(page);
  await expectScrollViewMode(page, false);
  // activate
  await clickScrollViewMenuButton(page);
  await expectScrollViewMode(page, true);
  // keyboard shortcuts works too
  // -- deactivate
  await page.keyboard.press('R');
  await expectScrollViewMode(page, false);
  // -- activate
  await page.keyboard.press('R');
  await expectScrollViewMode(page, true);
});

