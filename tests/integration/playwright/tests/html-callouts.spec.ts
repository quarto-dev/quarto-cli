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
