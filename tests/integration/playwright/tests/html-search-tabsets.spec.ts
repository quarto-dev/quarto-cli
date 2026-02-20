import { test, expect, Page } from "@playwright/test";

const BASE = './html/search-tabsets/_site/index.html';

// Helper: wait for search tab activation (deferred to pageshow)
// and return the active pane ID for a given tab-content index.
async function getActiveTabId(page: Page, tabContentIndex: number): Promise<string> {
  return page.evaluate((idx) => {
    const tabContents = document.querySelectorAll('.tab-content');
    const tc = tabContents[idx];
    if (!tc) return 'not-found';
    const active = tc.querySelector('.tab-pane.active');
    return active?.id ?? 'none';
  }, tabContentIndex);
}

// Helper: count marks visible (not inside an inactive tab pane)
async function visibleMarkCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('mark')).filter(m => {
      let el: Element | null = m;
      while (el) {
        if (el.classList?.contains('tab-pane') && !el.classList.contains('active')) {
          return false;
        }
        el = el.parentElement;
      }
      return true;
    }).length;
  });
}

test('Search activates inactive tab containing match', async ({ page }) => {
  await page.goto(`${BASE}?q=beta-unique-search-term`);

  // Mark should be visible (tab activation deferred to pageshow)
  const marks = page.locator('mark');
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // Tab Beta (tabset-1-2) should be active in the ungrouped tabset (index 0)
  const activeId = await getActiveTabId(page, 0);
  expect(activeId).toBe('tabset-1-2');

  await expect(marks).toHaveCount(1);
  expect(await visibleMarkCount(page)).toBe(1);
});

test('Search keeps active tab when it already has a match', async ({ page }) => {
  await page.goto(`${BASE}?q=gamma-both-tabs`);

  const marks = page.locator('mark');
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // R tab (tabset-2-1) should stay active — it already has a match
  const activeId = await getActiveTabId(page, 1);
  expect(activeId).toBe('tabset-2-1');

  // 2 marks total (one in each tab), only 1 visible (in active tab)
  await expect(marks).toHaveCount(2);
  expect(await visibleMarkCount(page)).toBe(1);
});

test('Search highlights outside tabs without changing tab state', async ({ page }) => {
  await page.goto(`${BASE}?q=epsilon-no-tabs`);

  const marks = page.locator('mark');
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // All tabs should remain at their defaults (first tab active)
  expect(await getActiveTabId(page, 0)).toBe('tabset-1-1');
  expect(await getActiveTabId(page, 1)).toBe('tabset-2-1');

  await expect(marks).toHaveCount(1);
  expect(await visibleMarkCount(page)).toBe(1);
});

test('Search activates both outer and inner tabs for nested match', async ({ page }) => {
  await page.goto(`${BASE}?q=nested-inner-only-term`);

  const marks = page.locator('mark');
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // Outer Tab B (tabset-6-2) and Inner Tab Y (tabset-5-2) should both activate.
  // Tabset indices: outer nested = 4, inner nested = 5
  expect(await getActiveTabId(page, 4)).toBe('tabset-6-2');
  expect(await getActiveTabId(page, 5)).toBe('tabset-5-2');

  await expect(marks).toHaveCount(1);
  expect(await visibleMarkCount(page)).toBe(1);
});

test('Search activation overrides localStorage tab preference', async ({ page }) => {
  // Pre-set localStorage to prefer "R" for the "language" group
  await page.goto(`${BASE}`);
  await page.evaluate(() => {
    localStorage.setItem(
      'quarto-persistent-tabsets-data',
      JSON.stringify({ language: 'R' })
    );
  });

  // Navigate with search query that matches only in the Python tab
  await page.goto(`${BASE}?q=python-only-content`);

  const marks = page.locator('mark');
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // Python tab (tabset-3-2) should be active despite localStorage saying "R"
  const activeId = await getActiveTabId(page, 2);
  expect(activeId).toBe('tabset-3-2');

  // Second grouped tabset should remain on R (no search match there)
  expect(await getActiveTabId(page, 3)).toBe('tabset-4-1');

  await expect(marks).toHaveCount(1);
  expect(await visibleMarkCount(page)).toBe(1);
});
