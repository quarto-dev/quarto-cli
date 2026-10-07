import { test, expect } from '@playwright/test';
import { getCSSProperty } from '../src/utils';

test('Simple untitled callout has symmetric spacing', async ({ page }) => {
  await page.goto('./html/callouts/callout-spacing.html');

  // Simple untitled callout structure:
  // .callout-style-simple > .callout-body > .callout-body-container > p
  const simpleUntitledSection = page.locator('#simple-untitled');
  const lastChild = simpleUntitledSection.locator('.callout-style-simple:not(.callout-titled) .callout-body-container > p:last-child');

  // Verify margin-bottom > 0 (compensation for -0.4em body margin is applied)
  const marginBottom = await getCSSProperty(lastChild, 'margin-bottom', true) as number;
  expect(marginBottom).toBeGreaterThan(0);
});

test('Simple titled callout spacing is handled by padding', async ({ page }) => {
  await page.goto('./html/callouts/callout-spacing.html');

  // Simple titled callout structure:
  // .callout-style-simple.callout-titled > .callout-body-container.callout-body > p
  const simpleTitledSection = page.locator('#simple-titled');
  const lastChild = simpleTitledSection.locator('.callout-style-simple.callout-titled .callout-body > p:last-child');

  const paddingBottom = await getCSSProperty(lastChild, 'padding-bottom', true) as number;
  expect(paddingBottom).toBeGreaterThan(0);
});

test('Default callout spacing is handled by padding', async ({ page }) => {
  await page.goto('./html/callouts/callout-spacing.html');

  // Default callouts always have .callout-titled class (even without explicit title)
  // Structure: .callout-style-default.callout-titled > .callout-body > p
  const defaultSection = page.locator('#default-untitled');
  const lastChild = defaultSection.locator('.callout-style-default .callout-body > p:last-child');

  const paddingBottom = await getCSSProperty(lastChild, 'padding-bottom', true) as number;
  expect(paddingBottom).toBeGreaterThan(0);
});

test.describe('Collapsible callout toggle is keyboard operable (#4934)', () => {
  test('Tab reaches the toggle; Enter and Space open and close it', async ({ page, browserName }) => {
    await page.goto('./html/callouts/callout-collapse-keyboard.html');
    // WebKit only tabs to buttons with Alt held
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';

    const button = page.locator('#collapsed .callout-toggle-btn');
    const body = page.locator('#collapsed .callout-collapse');
    // Bootstrap ignores a toggle while a collapse transition runs
    const settled = () => expect(body).not.toHaveClass(/collapsing/);
    await expect(button).toHaveAccessibleName('Note Starts collapsed');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(body).toBeHidden();

    for (let i = 0; i < 20; i++) {
      await page.keyboard.press(tab);
      if (await button.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(button).toBeFocused();
    await expect(button).toHaveCSS('outline-style', 'solid');

    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(body).toBeVisible();
    await settled();

    await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(body).toBeHidden();
    await settled();

    await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(body).toBeVisible();
  });

  test('An expanded callout starts open and collapses with Enter', async ({ page }) => {
    await page.goto('./html/callouts/callout-collapse-keyboard.html');
    const button = page.locator('#expanded .callout-toggle-btn');
    const body = page.locator('#expanded .callout-collapse');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(body).toBeVisible();

    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(body).toBeHidden();
  });
});
