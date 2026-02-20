import { test, expect, Page } from "@playwright/test";

const BASE = './html/search-tabsets/_site/index.html';

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

  // Tab Beta should be active in the ungrouped tabset
  await expect(page.getByRole('tab', { name: 'Tab Beta', exact: true })).toHaveClass(/active/);

  await expect(marks).toHaveCount(1);
  expect(await visibleMarkCount(page)).toBe(1);
});

test('Search keeps active tab when it already has a match', async ({ page }) => {
  await page.goto(`${BASE}?q=gamma-both-tabs`);

  const marks = page.locator('mark');
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // R tab should stay active — it already has a match
  const section = page.locator('#both-tabs-match');
  await expect(section.getByRole('tab', { name: 'R', exact: true })).toHaveClass(/active/);

  // 2 marks total (one in each tab), only 1 visible (in active tab)
  await expect(marks).toHaveCount(2);
  expect(await visibleMarkCount(page)).toBe(1);
});

test('Search highlights outside tabs without changing tab state', async ({ page }) => {
  await page.goto(`${BASE}?q=epsilon-no-tabs`);

  const marks = page.locator('mark');
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // All tabs should remain at their defaults (first tab active)
  await expect(page.getByRole('tab', { name: 'Tab Alpha', exact: true })).toHaveClass(/active/);
  const bothSection = page.locator('#both-tabs-match');
  await expect(bothSection.getByRole('tab', { name: 'R', exact: true })).toHaveClass(/active/);

  await expect(marks).toHaveCount(1);
  expect(await visibleMarkCount(page)).toBe(1);
});

test('Search activates both outer and inner tabs for nested match', async ({ page }) => {
  await page.goto(`${BASE}?q=nested-inner-only-term`);

  const marks = page.locator('mark');
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // Both outer and inner tabs should activate for the nested match
  await expect(page.getByRole('tab', { name: 'Outer Tab B', exact: true })).toHaveClass(/active/);
  await expect(page.getByRole('tab', { name: 'Inner Tab Y', exact: true })).toHaveClass(/active/);

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

  // Python tab should be active despite localStorage saying "R"
  const groupedSection = page.locator('#grouped-tabset');
  await expect(groupedSection.getByRole('tab', { name: 'Python', exact: true })).toHaveClass(/active/);

  // Second grouped tabset should remain on R (no search match there)
  const secondGrouped = page.locator('#second-grouped-tabset');
  await expect(secondGrouped.getByRole('tab', { name: 'R', exact: true })).toHaveClass(/active/);

  await expect(marks).toHaveCount(1);
  expect(await visibleMarkCount(page)).toBe(1);
});
