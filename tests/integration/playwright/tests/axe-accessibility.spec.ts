import { test, expect, Page } from '@playwright/test';

// -- Helpers --

async function collectConsoleLogs(page: Page): Promise<string[]> {
  const messages: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'log') messages.push(msg.text());
  });
  return messages;
}

async function waitForAxeCompletion(page: Page, timeout = 15000): Promise<void> {
  await page.locator('[data-quarto-axe-complete]').waitFor({ timeout });
}

function findAxeJsonResult(messages: string[]): { violations: { id: string }[] } | undefined {
  for (const m of messages) {
    try {
      const parsed = JSON.parse(m);
      if (parsed.violations !== undefined) return parsed;
    } catch {
      // not JSON
    }
  }
  return undefined;
}

// -- Test matrix --

type OutputMode = 'document' | 'console' | 'json';

interface AxeTestCase {
  format: string;
  outputMode: OutputMode;
  url: string;
  // Expected violation ID. RevealJS CSS transforms prevent axe-core from
  // computing color contrast, so revealjs tests check for a different violation.
  expectedViolation: string;
}

const testCases: AxeTestCase[] = [
  // HTML — bootstrap format, color contrast detected
  { format: 'html', outputMode: 'document', url: '/html/axe-accessibility.html',
    expectedViolation: 'color-contrast' },
  { format: 'html', outputMode: 'console', url: '/html/axe-console.html',
    expectedViolation: 'color-contrast' },
  { format: 'html', outputMode: 'json', url: '/html/axe-json.html',
    expectedViolation: 'color-contrast' },

  // RevealJS — axe-check.js loads as standalone module (#13781).
  // RevealJS CSS transforms prevent axe-core from computing color contrast,
  // so we check for link-name (slide-menu-button has unlabeled <a>).
  { format: 'revealjs', outputMode: 'document', url: '/revealjs/axe-accessibility.html',
    expectedViolation: 'link-name' },
  { format: 'revealjs', outputMode: 'console', url: '/revealjs/axe-console.html',
    expectedViolation: 'link-name' },
  { format: 'revealjs', outputMode: 'json', url: '/revealjs/axe-json.html',
    expectedViolation: 'link-name' },

  // RevealJS dark theme — verifies CSS custom property bridge for theming.
  // Report should use --r-background-color/#191919, not the Sass fallback #fff.
  { format: 'revealjs-dark', outputMode: 'document', url: '/revealjs/axe-accessibility-dark.html',
    expectedViolation: 'link-name' },

  // Dashboard — axe-check.js loads as standalone module, falls back to document.body (#13781)
  { format: 'dashboard', outputMode: 'document', url: '/dashboard/axe-accessibility.html',
    expectedViolation: 'color-contrast' },
];

// Map axe violation IDs to the text that appears in document/console reporters.
// Document reporter shows the full description; console reporter shows a shorter form.
const violationText: Record<string, { document: string; console: string }> = {
  'color-contrast': { document: 'color contrast', console: 'contrast' },
  'link-name': { document: 'discernible text', console: 'discernible text' },
  'image-alt': { document: 'alternative text', console: 'alternative text' },
};

// -- Tests --

test.describe('Axe accessibility checking', () => {
  for (const { format, outputMode, url, expectedViolation } of testCases) {
    test(`${format} — ${outputMode} mode detects ${expectedViolation} violation`, async ({ page }) => {
      expect(violationText[expectedViolation],
        `Missing violationText entry for "${expectedViolation}"`).toBeDefined();

      if (outputMode === 'document') {
        await page.goto(url, { waitUntil: 'networkidle' });

        if (format.startsWith('revealjs')) {
          // RevealJS: report appears as a dedicated slide, not a fixed overlay
          const reportSlide = page.locator('section.quarto-axe-report-slide');
          await expect(reportSlide).toBeAttached({ timeout: 10000 });
          await expect(reportSlide).toHaveClass(/scrollable/);

          // Slide has a title
          const title = reportSlide.locator('h2');
          await expect(title).toHaveText('Accessibility Report');

          // Report content is inside the slide
          const axeReport = reportSlide.locator('.quarto-axe-report');
          await expect(axeReport).toBeAttached();
          await expect(axeReport).toContainText(violationText[expectedViolation].document);

          // Report element is static (not fixed overlay)
          await expect(axeReport).toHaveCSS('position', 'static');

        } else if (format === 'dashboard') {
          // Dashboard: report appears in Bootstrap offcanvas sidebar
          const offcanvas = page.locator('#quarto-axe-offcanvas');
          await expect(offcanvas).toBeVisible({ timeout: 10000 });

          // Report content is inside the offcanvas
          const axeReport = offcanvas.locator('.quarto-axe-report');
          await expect(axeReport).toBeAttached();
          await expect(axeReport).toContainText(violationText[expectedViolation].document);

          // Toggle button exists
          const toggle = page.locator('.quarto-axe-toggle');
          await expect(toggle).toBeVisible();

          // Report is static inside offcanvas (not fixed overlay)
          await expect(axeReport).toHaveCSS('position', 'static');

        } else {
          // HTML: report appears as a fixed overlay
          const axeReport = page.locator('.quarto-axe-report');
          await expect(axeReport).toBeVisible({ timeout: 10000 });
          await expect(axeReport).toContainText(violationText[expectedViolation].document);

          // Verify report overlay CSS properties
          await expect(axeReport).toHaveCSS('z-index', '9999');
          await expect(axeReport).toHaveCSS('overflow-y', 'auto');

          // Background must not be transparent
          await expect(axeReport).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        }

      } else if (outputMode === 'console') {
        const messages = await collectConsoleLogs(page);
        await page.goto(url, { waitUntil: 'networkidle' });
        await waitForAxeCompletion(page);
        const expectedText = violationText[expectedViolation].console;
        expect(messages.some(m => m.toLowerCase().includes(expectedText)),
          `Expected console output to contain "${expectedText}"`).toBe(true);

      } else if (outputMode === 'json') {
        const messages = await collectConsoleLogs(page);
        await page.goto(url, { waitUntil: 'networkidle' });
        await waitForAxeCompletion(page);
        const result = findAxeJsonResult(messages);
        expect(result).toBeDefined();
        expect(result!.violations.length).toBeGreaterThan(0);
        expect(result!.violations.some(v => v.id === expectedViolation)).toBe(true);
      }
    });
  }
});

test.describe('RevealJS axe — cross-slide scanning and state restoration', () => {
  const revealjsUrl = '/revealjs/axe-accessibility.html';

  test('report slide exists when completion signal fires', async ({ page }) => {
    await page.goto(revealjsUrl, { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);
    await expect(page.locator('section.quarto-axe-report-slide')).toBeAttached();
  });

  test('detects image-alt violation on non-visible slide', async ({ page }) => {
    await page.goto(revealjsUrl, { waitUntil: 'networkidle' });
    const reportSlide = page.locator('section.quarto-axe-report-slide');
    await expect(reportSlide).toBeAttached({ timeout: 10000 });
    await expect(reportSlide).toContainText(violationText['image-alt'].document);
  });

  test('restores presentation state after axe completes', async ({ page }) => {
    await page.goto(revealjsUrl, { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);

    // Reveal state should be valid: on slide 0 (first slide)
    const state = await page.evaluate(() => Reveal.getState());
    expect(state.indexh).toBe(0);

    // Non-present slides must have hidden and aria-hidden restored
    const slideState = await page.evaluate(() => {
      return Reveal.getSlides().map((s: Element) => ({
        id: s.id || s.className.substring(0, 30),
        isPresent: s.classList.contains('present'),
        hidden: s.hasAttribute('hidden'),
        ariaHidden: s.getAttribute('aria-hidden'),
      }));
    });

    for (const slide of slideState) {
      if (slide.isPresent) {
        expect(slide.hidden, `Present slide "${slide.id}" should not be hidden`).toBe(false);
        expect(slide.ariaHidden, `Present slide "${slide.id}" should not have aria-hidden`).toBeNull();
      } else {
        expect(slide.hidden, `Non-present slide "${slide.id}" should be hidden`).toBe(true);
        expect(slide.ariaHidden, `Non-present slide "${slide.id}" should have aria-hidden`).toBe('true');
      }
    }
  });

  test('click navigates to slide containing violation element', async ({ page }) => {
    await page.goto(revealjsUrl, { waitUntil: 'networkidle' });
    const reportSlide = page.locator('section.quarto-axe-report-slide');
    await expect(reportSlide).toBeAttached({ timeout: 10000 });

    // Navigate to the report slide (last slide) and wait for transition
    await page.evaluate(() => {
      Reveal.slide(Reveal.getTotalSlides() - 1);
    });
    await expect(reportSlide).toHaveClass(/present/);

    // Click the img violation target — the img is on Slide 2 (index 1)
    const imgTarget = reportSlide.locator('.quarto-axe-violation-target', { hasText: 'img' });
    await imgTarget.click();

    // After click, Reveal should have navigated to Slide 2 (index 1)
    const afterClick = await page.evaluate(() => Reveal.getIndices().h);
    expect(afterClick).toBe(1);

    // The img element should have the highlight class
    const highlightedImg = page.locator('img.quarto-axe-hover-highlight');
    await expect(highlightedImg).toBeAttached({ timeout: 3000 });
  });

  test('detects image-alt violation on hidden vertical slide', async ({ page }) => {
    await page.goto('/revealjs/axe-accessibility-vertical.html', { waitUntil: 'networkidle' });
    const reportSlide = page.locator('section.quarto-axe-report-slide');
    await expect(reportSlide).toBeAttached({ timeout: 10000 });
    await expect(reportSlide).toContainText(violationText['image-alt'].document);
  });
});

test.describe('Dashboard axe — offcanvas interaction and highlight', () => {
  const dashboardUrl = '/dashboard/axe-accessibility.html';

  test('offcanvas can be closed and reopened via toggle button', async ({ page }) => {
    await page.goto(dashboardUrl, { waitUntil: 'networkidle' });
    const offcanvas = page.locator('#quarto-axe-offcanvas');
    await expect(offcanvas).toBeVisible({ timeout: 10000 });

    // Close via close button
    await offcanvas.locator('.btn-close').click();
    await expect(offcanvas).not.toBeVisible();

    // Toggle button should still be visible
    const toggle = page.locator('.quarto-axe-toggle');
    await expect(toggle).toBeVisible();

    // Reopen via toggle
    await toggle.click();
    await expect(offcanvas).toBeVisible();
  });

  test('hover highlights the corresponding dashboard element', async ({ page }) => {
    await page.goto(dashboardUrl, { waitUntil: 'networkidle' });
    const offcanvas = page.locator('#quarto-axe-offcanvas');
    await expect(offcanvas).toBeVisible({ timeout: 10000 });

    // Find the first violation target in the offcanvas and get its CSS selector text
    const target = offcanvas.locator('.quarto-axe-violation-target').first();
    const selector = await target.textContent();

    // Hover the target
    await target.hover();

    // The corresponding element in the dashboard should get highlight class
    const highlighted = page.locator(`${selector}.quarto-axe-hover-highlight`);
    await expect(highlighted).toBeAttached({ timeout: 3000 });

    // Move mouse away — highlight should be removed
    await page.mouse.move(0, 0);
    await expect(highlighted).not.toBeAttached();
  });
});
