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

test('Search with hash fragment scrolls to target section, not first match', async ({ page }) => {
  // Use a very small viewport so mark and hash target can't both be visible
  await page.setViewportSize({ width: 800, height: 200 });
  // Navigate with ?q= matching near the top AND #hash pointing to section further down
  await page.goto(`${BASE}?q=beta-unique-search-term#grouped-tabset`);

  // Marks should exist (highlighting works)
  const marks = page.locator('mark');
  await expect(marks.first()).toBeVisible({ timeout: 5000 });

  // Wait for all scroll behavior to settle (rAF + smooth scroll animation)
  await page.waitForFunction(() => {
    return new Promise<boolean>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTimeout(() => resolve(true), 800);
      }));
    });
  });

  // The hash target section should still be in viewport (not scrolled away to first mark)
  const section = page.locator('#grouped-tabset');
  await expect(section).toBeInViewport();
});

test('Search scrolls to first visible match', async ({ page }) => {
  // Use small viewport so the nested tabset at the bottom is below the fold,
  // ensuring the test actually exercises scrollIntoView (not trivially passing).
  await page.setViewportSize({ width: 800, height: 400 });
  await page.goto(`${BASE}?q=nested-inner-only-term`);

  const mark = page.locator('mark').first();
  await expect(mark).toBeVisible({ timeout: 5000 });
  await expect(mark).toBeInViewport();
});
