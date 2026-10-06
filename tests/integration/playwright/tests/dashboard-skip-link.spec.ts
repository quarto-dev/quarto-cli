import { test, expect } from '@playwright/test';

const dashboard = '/dashboard/hash-navigation.html';

const heatPane = (page) => page.locator('#heat.dashboard-page');
const coolPane = (page) => page.locator('#cool.dashboard-page');

// WebKit only tabs to links when the Alt modifier is held, which matches
// Safari's default "Press Tab to highlight each item on a webpage" setting
const tabKeyFor = (browserName: string) =>
  browserName === 'webkit' ? 'Alt+Tab' : 'Tab';

// https://github.com/quarto-dev/quarto-cli/issues/14684
test('the skip link is the first tab stop and moves focus into the content', async ({ page, browserName }) => {
  await page.goto(dashboard);
  await page.keyboard.press(tabKeyFor(browserName));
  await expect(page.locator('#quarto-skip-link')).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.locator('#quarto-document-content')).toBeFocused();
});

test('the skip link does not add a history entry', async ({ page, browserName }) => {
  await page.goto(dashboard);
  await expect(heatPane(page)).toHaveClass(/active/);

  await page.keyboard.press(tabKeyFor(browserName));
  await page.keyboard.press('Enter');
  await expect(page.locator('#quarto-document-content')).toBeFocused();
  // a plain anchor jump would leave "#quarto-document-content" here
  expect(await page.evaluate(() => window.location.hash)).toBe('');

  // so a single Back returns to the previous page rather than to a dead
  // history step that changes the URL but not the page
  await page.locator('.navbar .nav-link[data-bs-target="#cool"]').click();
  await expect(coolPane(page)).toHaveClass(/active/);
  await page.goBack();
  await expect(heatPane(page)).toHaveClass(/active/);
});

test('the skip link keeps a page hash in the URL', async ({ page, browserName }) => {
  await page.goto(`${dashboard}#cool`);
  await expect(coolPane(page)).toHaveClass(/active/);

  await page.keyboard.press(tabKeyFor(browserName));
  await expect(page.locator('#quarto-skip-link')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.locator('#quarto-document-content')).toBeFocused();
  // the shareable URL for the page survives using the skip link
  expect(await page.evaluate(() => window.location.hash)).toBe('#cool');
  await expect(coolPane(page)).toHaveClass(/active/);
});
