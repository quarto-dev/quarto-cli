import { expect, Page, test } from '@playwright/test';

// Playwright does not hide the page when another tab is brought to the front,
// so mark it hidden and then visible again, as switching tabs does.
const hideAndShow = (page: Page) =>
  page.evaluate(() => {
    const set = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (hidden ? 'hidden' : 'visible'),
      });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    set(true);
    set(false);
  });

test.describe('the focus stays where it was when the presentation is shown again (#15079)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./revealjs/visibility-focus.html#/slide-1');
    await expect(page.locator('.reveal.ready')).toBeAttached();
  });

  test('a link on a slide keeps the focus', async ({ page }) => {
    const link = page.getByRole('link', { name: 'A link on slide-1' });
    await link.focus();
    await hideAndShow(page);
    await expect(link).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/#\/slide-2$/);
  });

  test('a frame hands the focus to the deck, where keys reach reveal.js', async ({ page }) => {
    await page.frameLocator('iframe').getByRole('button', { name: 'Button in a frame' }).focus();
    await hideAndShow(page);
    await expect(page.locator('.reveal')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/#\/slide-2$/);
  });

  test('the deck keeps the focus', async ({ page }) => {
    const deck = page.locator('.reveal');
    await deck.evaluate((element) => {
      element.setAttribute('tabindex', '-1');
      (element as HTMLElement).focus();
    });
    await hideAndShow(page);
    await expect(deck).toBeFocused();
  });

  test('a focus on the body stays there', async ({ page }) => {
    await hideAndShow(page);
    await expect(page.locator('body')).toBeFocused();
  });
});
