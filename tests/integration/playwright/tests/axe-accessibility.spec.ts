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
  // WCAG conformance label the document reporter derives from the violation's
  // axe-core tags (#14604). Only the document reporter renders this.
  expectedConformance?: string;
}

const testCases: AxeTestCase[] = [
  // HTML — bootstrap format, color contrast detected
  { format: 'html', outputMode: 'document', url: '/html/axe-accessibility.html',
    expectedViolation: 'color-contrast', expectedConformance: 'WCAG 2.0 AA (1.4.3)' },
  { format: 'html', outputMode: 'console', url: '/html/axe-console.html',
    expectedViolation: 'color-contrast' },
  { format: 'html', outputMode: 'json', url: '/html/axe-json.html',
    expectedViolation: 'color-contrast' },

  // RevealJS — axe-check.js loads as standalone module (#13781).
  // RevealJS CSS transforms prevent axe-core from computing color contrast,
  // so we check for link-name (slide-menu-button has unlabeled <a>).
  { format: 'revealjs', outputMode: 'document', url: '/revealjs/axe-accessibility.html',
    expectedViolation: 'link-name', expectedConformance: 'WCAG 2.0 A (2.4.4, 4.1.2)' },
  { format: 'revealjs', outputMode: 'console', url: '/revealjs/axe-console.html',
    expectedViolation: 'link-name' },
  { format: 'revealjs', outputMode: 'json', url: '/revealjs/axe-json.html',
    expectedViolation: 'link-name' },

  // RevealJS dark theme — verifies CSS custom property bridge for theming.
  // Report should use --r-background-color/#191919, not the Sass fallback #fff.
  { format: 'revealjs-dark', outputMode: 'document', url: '/revealjs/axe-accessibility-dark.html',
    expectedViolation: 'link-name', expectedConformance: 'WCAG 2.0 A (2.4.4, 4.1.2)' },

  // Dashboard — axe-check.js loads as standalone module, falls back to document.body (#13781)
  { format: 'dashboard', outputMode: 'document', url: '/dashboard/axe-accessibility.html',
    expectedViolation: 'color-contrast', expectedConformance: 'WCAG 2.0 AA (1.4.3)' },
  { format: 'dashboard', outputMode: 'console', url: '/dashboard/axe-console.html',
    expectedViolation: 'color-contrast' },
  { format: 'dashboard', outputMode: 'json', url: '/dashboard/axe-json.html',
    expectedViolation: 'color-contrast' },

  // Dashboard dark theme — verifies CSS custom property bridge for theming
  { format: 'dashboard-dark', outputMode: 'document', url: '/dashboard/axe-accessibility-dark.html',
    expectedViolation: 'color-contrast', expectedConformance: 'WCAG 2.0 AA (1.4.3)' },

  // Dashboard with pages — multi-page dashboard with global sidebar
  { format: 'dashboard-pages', outputMode: 'document', url: '/dashboard/axe-accessibility-pages.html',
    expectedViolation: 'color-contrast', expectedConformance: 'WCAG 2.0 AA (1.4.3)' },
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
  for (const { format, outputMode, url, expectedViolation, expectedConformance } of testCases) {
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

          // Conformance level is derived from the violation's axe-core tags (#14604)
          if (expectedConformance) {
            await expect(axeReport).toContainText(expectedConformance);
          }

          // Report element is static (not fixed overlay)
          await expect(axeReport).toHaveCSS('position', 'static');

        } else if (format.startsWith('dashboard')) {
          // Dashboard: report appears in Bootstrap offcanvas sidebar
          const offcanvas = page.locator('#quarto-axe-offcanvas');
          await expect(offcanvas).toBeVisible({ timeout: 10000 });

          // Report content is inside the offcanvas
          const axeReport = offcanvas.locator('.quarto-axe-report');
          await expect(axeReport).toBeAttached();
          await expect(axeReport).toContainText(violationText[expectedViolation].document);

          // Conformance level is derived from the violation's axe-core tags (#14604)
          if (expectedConformance) {
            await expect(axeReport).toContainText(expectedConformance);
          }

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

          // Conformance level is derived from the violation's axe-core tags (#14604)
          if (expectedConformance) {
            await expect(axeReport).toContainText(expectedConformance);
          }

          // Verify report overlay CSS properties
          await expect(axeReport).toHaveCSS('z-index', '9999');
          await expect(axeReport).toHaveCSS('overflow-y', 'auto');

          // Overlay must not inherit page-level centering (e.g. about
          // templates center <main>, which the overlay is appended into)
          await expect(axeReport).toHaveCSS('text-align', 'left');

          // The overlay scrolls when the report overflows, so it must be a
          // focusable, labeled region or it fails axe's own
          // scrollable-region-focusable rule
          await expect(axeReport).toHaveAttribute('tabindex', '0');
          await expect(axeReport).toHaveAttribute('role', 'region');
          await expect(axeReport).toHaveAttribute('aria-label', 'Accessibility report');

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
    // Use .first() since axe-core may produce non-unique selectors (e.g., "span").
    // This tests integration (hover triggers highlight) not selector uniqueness.
    const element = page.locator(selector).first();
    await expect(element).toHaveClass(/quarto-axe-hover-highlight/, { timeout: 3000 });

    // Move mouse to top-left corner (away from all elements) to clear hover state
    await page.mouse.move(0, 0);
    await expect(element).not.toHaveClass(/quarto-axe-hover-highlight/);
  });
});

test.describe('HTML axe — hover interaction and highlight', () => {
  const htmlUrl = '/html/axe-accessibility.html';

  test('hover highlights the corresponding page element', async ({ page }) => {
    await page.goto(htmlUrl, { waitUntil: 'networkidle' });

    // Wait for axe to complete
    const axeReport = page.locator('.quarto-axe-report');
    await expect(axeReport).toBeVisible({ timeout: 10000 });

    // Find the first violation target and get its CSS selector text
    const target = axeReport.locator('.quarto-axe-violation-target').first();
    const selector = await target.textContent();

    // Hover the target (event bubbles to parent with mouseenter listener)
    await target.hover();

    // The corresponding element on the page should get highlight class
    // Use .first() since axe-core may produce non-unique selectors (e.g., "span").
    // This tests integration (hover triggers highlight) not selector uniqueness.
    const element = page.locator(selector).first();
    await expect(element).toHaveClass(/quarto-axe-hover-highlight/, { timeout: 3000 });

    // Move mouse to top-left corner (away from all elements) to clear hover state
    await page.mouse.move(0, 0);
    await expect(element).not.toHaveClass(/quarto-axe-hover-highlight/);
  });
});

test.describe('HTML axe — hover scrolls element clear of the report overlay', () => {
  test('highlighted element settles above the overlay, not under it', async ({ page }) => {
    await page.goto('/html/axe-overlay-scroll.html', { waitUntil: 'networkidle' });

    const axeReport = page.locator('.quarto-axe-report');
    await expect(axeReport).toBeVisible({ timeout: 10000 });

    // Hover the selector for the full-width violation near the page bottom.
    // Default block:center scrolling would land it under the bottom-right
    // fixed overlay; the overlay-aware scroll targets the band above it.
    const target = axeReport.locator('.quarto-axe-violation-target', {
      hasText: '#bottom-contrast',
    });
    await target.hover();

    // axe targets the text-bearing element (the <p> inside #bottom-contrast,
    // e.g. "#bottom-contrast > p"), so locate the highlight by class rather
    // than assuming the exact selector.
    const element = page.locator('.quarto-axe-hover-highlight');
    await expect(element).toBeAttached({ timeout: 3000 });

    // Poll until the smooth scroll settles with the element fully inside the
    // viewport band above the overlay.
    await expect.poll(async () => {
      const elementBox = await element.boundingBox();
      const overlayBox = await axeReport.boundingBox();
      if (!elementBox || !overlayBox) return 'missing bounding box';
      if (elementBox.y < 0) return `element top ${elementBox.y} above viewport`;
      if (elementBox.y + elementBox.height > overlayBox.y) {
        return `element bottom ${elementBox.y + elementBox.height} below overlay top ${overlayBox.y}`;
      }
      return 'clear of overlay';
    }, { timeout: 5000 }).toBe('clear of overlay');
  });
});

test.describe('HTML axe — the report overlay passes its own scan', () => {
  test('overlay has no axe-core violations', async ({ page }) => {
    // The overlay is injected after the page scan runs, so it never audits
    // itself. Scan it here with the same vendored axe-core build the page
    // already loaded (window.axe), on the long-report page where the overlay
    // is scrollable — the state that tripped scrollable-region-focusable.
    await page.goto('/html/axe-overlay-scroll.html', { waitUntil: 'networkidle' });

    const axeReport = page.locator('.quarto-axe-report');
    await expect(axeReport).toBeVisible({ timeout: 10000 });

    const violations = await page.evaluate(async () => {
      const axe = (window as any).axe;
      const result = await axe.run(document.querySelector('.quarto-axe-report'));
      return result.violations.map((v: { id: string; nodes: { target: string[] }[] }) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      }));
    });
    expect(violations).toEqual([]);
  });
});

test.describe('RevealJS axe — the report slide passes its own scan', () => {
  test('report slide has no axe-core violations', async ({ page }) => {
    // The report slide is injected after the page scan runs, so it never
    // audits itself (same gap as the HTML overlay). Scan it here with the
    // same vendored axe-core build the deck already loaded (window.axe).
    //
    // createReportSlide() navigates back to the original slide, leaving the
    // report slide as a hidden future slide (hidden + aria-hidden). axe skips
    // hidden elements, so we MUST navigate to the report slide and wait for
    // `.present` first — otherwise the scan is a vacuous, permanent PASS.
    await page.goto('/revealjs/axe-accessibility.html', { waitUntil: 'networkidle' });

    const reportSlide = page.locator('section.quarto-axe-report-slide');
    await expect(reportSlide).toBeAttached({ timeout: 10000 });
    await waitForAxeCompletion(page);

    await page.evaluate(() => Reveal.slide(Reveal.getTotalSlides() - 1));
    await expect(reportSlide).toHaveClass(/present/);

    // Non-empty precondition: guards against the region silently becoming
    // empty in a future refactor, which would make violations == [] a
    // vacuous pass rather than a real guard.
    await expect(
      reportSlide.locator('.quarto-axe-violation-description'),
    ).not.toHaveCount(0);

    const violations = await page.evaluate(async () => {
      const axe = (window as any).axe;
      const result = await axe.run(document.querySelector('.quarto-axe-report-slide'));
      return result.violations.map((v: { id: string; nodes: { target: string[] }[] }) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      }));
    });
    expect(violations).toEqual([]);
  });
});

test.describe('Dashboard axe — the offcanvas passes its own scan', () => {
  test('offcanvas and toggle have no axe-core violations', async ({ page }) => {
    // The offcanvas and its toggle button are injected after the page scan
    // runs, so they never audit themselves on initial load. Scan both here.
    // The toggle (.quarto-axe-toggle) is a SIBLING of #quarto-axe-offcanvas
    // (both appended to <body>), so it must be an explicit include — scanning
    // the offcanvas alone would miss a dropped aria-label on the toggle.
    await page.goto('/dashboard/axe-accessibility.html', { waitUntil: 'networkidle' });

    const offcanvas = page.locator('#quarto-axe-offcanvas');
    await expect(offcanvas).toBeVisible({ timeout: 10000 });

    // Non-empty precondition — see reveal test above for rationale.
    await expect(
      offcanvas.locator('.quarto-axe-violation-description'),
    ).not.toHaveCount(0);

    const violations = await page.evaluate(async () => {
      const axe = (window as any).axe;
      const result = await axe.run({
        include: [['#quarto-axe-offcanvas'], ['.quarto-axe-toggle']],
      });
      return result.violations.map((v: { id: string; nodes: { target: string[] }[] }) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      }));
    });

    // Known issue quarto-dev/quarto-cli#14710: .offcanvas-body is a scrolling
    // region with no focusable descendant and isn't itself focusable, so it
    // trips scrollable-region-focusable even on this short fixture (its fixed
    // height already overflows). That one node is filtered out (not
    // test.fail()'d) at the node level — not the whole violation — so this
    // test still catches any other regression here, including a second,
    // unrelated scrollable-region-focusable node — while #14710 is open.
    const unexpected = violations
      .map((v) =>
        v.id === 'scrollable-region-focusable'
          ? { ...v, targets: v.targets.filter((t) => !t.includes('.offcanvas-body')) }
          : v,
      )
      .filter((v) => v.targets.length > 0);
    expect(unexpected).toEqual([]);
  });
});

test.describe('Dashboard axe — re-scan on visibility change', () => {
  const pagesUrl = '/dashboard/axe-accessibility-pages.html';

  // Helper: collect violation target IDs from the offcanvas report
  async function getViolationTargetIds(page: Page): Promise<string[]> {
    return page.evaluate(() => {
      const targets = document.querySelectorAll('#quarto-axe-offcanvas .quarto-axe-violation-target');
      return Array.from(targets).map(t => t.textContent || '');
    });
  }

  test('re-scans when switching to Page 2 — page 1 violations disappear', async ({ page }) => {
    await page.goto(pagesUrl, { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);

    // Initial scan should include #page1-contrast (Page 1 is active)
    const initialTargets = await getViolationTargetIds(page);
    expect(initialTargets.some(t => t.includes('#page1-contrast')),
      'Initial scan should detect #page1-contrast').toBe(true);

    // Switch to Page 2 — remove completion signal first so we detect the NEXT scan
    await page.evaluate(() => document.body.removeAttribute('data-quarto-axe-complete'));
    await page.getByRole('tab', { name: 'Page 2' }).click();
    await waitForAxeCompletion(page);

    // After rescan, #page1-contrast should be gone (Page 1 is now hidden)
    const afterTargets = await getViolationTargetIds(page);
    expect(afterTargets.some(t => t.includes('#page1-contrast')),
      'After switching to Page 2, #page1-contrast should not be detected').toBe(false);

    // Sidebar violation should still be present (sidebar is visible on all pages)
    expect(afterTargets.some(t => t.includes('#sidebar-contrast')),
      '#sidebar-contrast should still be detected').toBe(true);

    // Card tabset Tab A is active by default on Page 2 — its violation should appear
    expect(afterTargets.some(t => t.includes('#tab-a-contrast')),
      '#tab-a-contrast should be detected (Tab A is active on Page 2)').toBe(true);
  });

  test('switching back to Page 1 restores page 1 violations', async ({ page }) => {
    await page.goto(pagesUrl, { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);

    // Switch to Page 2
    await page.evaluate(() => document.body.removeAttribute('data-quarto-axe-complete'));
    await page.getByRole('tab', { name: 'Page 2' }).click();
    await waitForAxeCompletion(page);

    // Switch back to Page 1
    await page.evaluate(() => document.body.removeAttribute('data-quarto-axe-complete'));
    await page.getByRole('tab', { name: 'Page 1' }).click();
    await waitForAxeCompletion(page);

    // #page1-contrast should be back
    const targets = await getViolationTargetIds(page);
    expect(targets.some(t => t.includes('#page1-contrast')),
      'After switching back to Page 1, #page1-contrast should be detected again').toBe(true);
  });

  test('re-scans on sidebar toggle — collapsed sidebar hides violations', async ({ page }) => {
    await page.goto(pagesUrl, { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);

    // Initial scan should include #sidebar-contrast
    const initialTargets = await getViolationTargetIds(page);
    expect(initialTargets.some(t => t.includes('#sidebar-contrast')),
      'Initial scan should detect #sidebar-contrast').toBe(true);

    // Collapse the sidebar
    await page.evaluate(() => document.body.removeAttribute('data-quarto-axe-complete'));
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    await waitForAxeCompletion(page);

    // After collapse, #sidebar-contrast should be gone (sidebar is hidden)
    const collapsedTargets = await getViolationTargetIds(page);
    expect(collapsedTargets.some(t => t.includes('#sidebar-contrast')),
      'After collapsing sidebar, #sidebar-contrast should not be detected').toBe(false);

    // Expand the sidebar again
    await page.evaluate(() => document.body.removeAttribute('data-quarto-axe-complete'));
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    await waitForAxeCompletion(page);

    // #sidebar-contrast should be back
    const expandedTargets = await getViolationTargetIds(page);
    expect(expandedTargets.some(t => t.includes('#sidebar-contrast')),
      'After expanding sidebar, #sidebar-contrast should be detected again').toBe(true);
  });

  test('back/forward navigation triggers rescan', async ({ page }) => {
    await page.goto(pagesUrl, { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);

    // Switch to Page 2 (this pushes history via Bootstrap tab)
    await page.evaluate(() => document.body.removeAttribute('data-quarto-axe-complete'));
    await page.getByRole('tab', { name: 'Page 2' }).click();
    await waitForAxeCompletion(page);

    // Verify Page 2 is active and page1-contrast is gone
    const page2Targets = await getViolationTargetIds(page);
    expect(page2Targets.some(t => t.includes('#page1-contrast'))).toBe(false);

    // Go back — this triggers popstate, which should rescan
    await page.evaluate(() => document.body.removeAttribute('data-quarto-axe-complete'));
    await page.goBack();
    await waitForAxeCompletion(page);

    // Page 1 should be active again, with its violations restored
    const backTargets = await getViolationTargetIds(page);
    expect(backTargets.some(t => t.includes('#page1-contrast')),
      'After going back, #page1-contrast should be detected again').toBe(true);
  });

  test('re-scans on card tabset switch — hidden tab violations disappear', async ({ page }) => {
    await page.goto(pagesUrl, { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);

    // Switch to Page 2 where the card tabset lives
    await page.evaluate(() => document.body.removeAttribute('data-quarto-axe-complete'));
    await page.getByRole('tab', { name: 'Page 2' }).click();
    await waitForAxeCompletion(page);

    // Tab A is active by default — #tab-a-contrast should be present
    const tabATargets = await getViolationTargetIds(page);
    expect(tabATargets.some(t => t.includes('#tab-a-contrast')),
      'Tab A active: #tab-a-contrast should be detected').toBe(true);

    // Switch to Tab B within the card tabset
    await page.evaluate(() => document.body.removeAttribute('data-quarto-axe-complete'));
    await page.getByRole('tab', { name: 'Tab B' }).click();
    await waitForAxeCompletion(page);

    // Tab A is now hidden — #tab-a-contrast should be gone
    const tabBTargets = await getViolationTargetIds(page);
    expect(tabBTargets.some(t => t.includes('#tab-a-contrast')),
      'Tab B active: #tab-a-contrast should not be detected').toBe(false);

    // Switch back to Tab A
    await page.evaluate(() => document.body.removeAttribute('data-quarto-axe-complete'));
    await page.getByRole('tab', { name: 'Tab A' }).click();
    await waitForAxeCompletion(page);

    // #tab-a-contrast should reappear
    const restoredTargets = await getViolationTargetIds(page);
    expect(restoredTargets.some(t => t.includes('#tab-a-contrast')),
      'Tab A restored: #tab-a-contrast should be detected again').toBe(true);
  });
});

test.describe('Axe report — violations sorted by severity (#14676)', () => {
  test('html — report lists critical before serious before moderate', async ({ page }) => {
    // Fixture triggers image-alt (critical), color-contrast (serious), and
    // heading-order (moderate). axe-core emits these roughly alphabetically by
    // rule id (color-contrast, heading-order, image-alt), which is not
    // severity order, so this fails if the report stops sorting.
    await page.goto('/html/axe-sort-order.html', { waitUntil: 'networkidle' });

    const axeReport = page.locator('.quarto-axe-report');
    await expect(axeReport).toBeVisible({ timeout: 10000 });

    const descriptions = await axeReport
      .locator('.quarto-axe-violation-description').allTextContents();
    const indexOf = (impact: string) =>
      descriptions.findIndex(d => d.startsWith(impact));

    for (const impact of ['Critical', 'Serious', 'Moderate']) {
      expect(indexOf(impact),
        `Expected a ${impact} violation in: ${descriptions.join(' | ')}`)
        .toBeGreaterThanOrEqual(0);
    }
    expect(indexOf('Critical')).toBeLessThan(indexOf('Serious'));
    expect(indexOf('Serious')).toBeLessThan(indexOf('Moderate'));
  });
});

test.describe('Axe — code line-number anchors have accessible names (#14655)', () => {
  test('html — numbered code block has no axe violations', async ({ page }) => {
    await page.goto('/html/axe-code-line-numbers.html', { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);

    const axeReport = page.locator('.quarto-axe-report');
    await expect(axeReport).toBeVisible({ timeout: 10000 });
    await expect(axeReport.locator('.quarto-axe-no-violations'))
      .toHaveText('No axe-core violations found.');
  });

  test('revealjs — code line-number anchors are not reported for missing link text', async ({ page }) => {
    await page.goto('/revealjs/axe-code-line-numbers.html', { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);

    const reportSlide = page.locator('section.quarto-axe-report-slide');
    await expect(reportSlide).toBeAttached({ timeout: 10000 });

    // RevealJS chrome (.slide-menu-button) and its default viewport meta trip
    // their own pre-existing, unrelated violations — out of scope for #14655.
    // The regression guard here is narrower: no violation should target a
    // code line-number anchor (id `cbN-n`).
    const targets = await reportSlide.locator('.quarto-axe-violation-target').allTextContents();
    const codeLineTargets = targets.filter((t) => /#cb\d+-\d+/.test(t));
    expect(codeLineTargets, `Unexpected code-line-number targets: ${targets.join(', ')}`).toEqual([]);
  });
});

test.describe('Axe — standard and best-practice scoping (#14607)', () => {
  // The fixtures share the same body — an image-alt violation (WCAG 2.0 A),
  // a color-contrast violation (WCAG 2.0 AA), and a heading-order violation
  // (axe best practice) — and differ only in their axe options. Presence in one
  // case proves absence in another is scoping, not a fixture that stopped violating.
  interface ScopeCase {
    name: string;
    url: string;
    expected: string[]; // violation ids that must be reported
    excluded: string[]; // violation ids that must not be reported
  }

  const scopeCases: ScopeCase[] = [
    { name: 'standard: wcag2a reports A violations only',
      url: '/html/axe-standard.html',
      expected: ['image-alt'],
      excluded: ['color-contrast', 'heading-order'] },
    { name: 'standard: wcag21aa + best-practice: true reports A, AA, and best-practice',
      url: '/html/axe-standard-best-practice.html',
      expected: ['image-alt', 'color-contrast', 'heading-order'],
      excluded: [] },
    { name: 'best-practice: false without standard drops only best-practice rules',
      url: '/html/axe-no-best-practice.html',
      expected: ['image-alt', 'color-contrast'],
      excluded: ['heading-order'] },
  ];

  for (const { name, url, expected, excluded } of scopeCases) {
    test(name, async ({ page }) => {
      const messages = await collectConsoleLogs(page);
      await page.goto(url, { waitUntil: 'networkidle' });
      await waitForAxeCompletion(page);

      const result = findAxeJsonResult(messages);
      expect(result).toBeDefined();
      const ids = result!.violations.map(v => v.id);
      for (const id of expected) {
        expect(ids, `expected "${id}" to be reported`).toContain(id);
      }
      for (const id of excluded) {
        expect(ids, `expected "${id}" not to be reported`).not.toContain(id);
      }
    });
  }

  test('standard with no output falls back to console reporting, still scoped', async ({ page }) => {
    // `axe: {standard: wcag2a}` with no `output` key previously hit
    // `reporters[undefined]` and silently did nothing; it now defaults to the
    // console reporter, which logs each violation's description text.
    const messages = await collectConsoleLogs(page);
    await page.goto('/html/axe-standard-default-output.html', { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);

    // Assert only on the console reporter's violation-description lines (axe
    // rule descriptions all start with "Ensure"); the reporter also logs
    // selectors and elements, and an unrelated console message could contain
    // words like "heading" or "contrast".
    const descriptions = messages
      .filter((m) => m.startsWith('Ensure'))
      .join('\n')
      .toLowerCase();
    expect(descriptions, 'image-alt (WCAG 2.0 A) should be reported on the console')
      .toContain('alternative text');
    expect(descriptions, 'color-contrast (AA) is outside standard: wcag2a')
      .not.toContain('contrast');
    expect(descriptions, 'heading-order (best practice) is outside standard: wcag2a')
      .not.toContain('heading');
  });
});

test.describe('Axe — no third-party/CDN dependency (regression guard for #14677)', () => {
  const CDN_DENYLIST = [
    'skypack.dev',
    'unpkg.com',
    'jsdelivr.net',
    'esm.sh',
    'cdnjs.cloudflare.com',
  ];

  function cdnHost(url: string): string | null {
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return null;
    }
    return CDN_DENYLIST.find(
      (base) => hostname === base || hostname.endsWith('.' + base),
    ) ?? null;
  }

  test('html — axe-enabled page makes no request to a package CDN', async ({ page }) => {
    const cdnRequests: string[] = [];
    page.on('request', (req) => {
      if (cdnHost(req.url())) cdnRequests.push(req.url());
    });

    await page.goto('/html/axe-accessibility.html', { waitUntil: 'networkidle' });
    await waitForAxeCompletion(page);

    expect(
      cdnRequests,
      `axe-enabled page must not load resources from a package CDN. ` +
        `Offending request(s): ${cdnRequests.join(', ')}`,
    ).toEqual([]);
  });
});

test.describe('HTML axe — the report overlay scrolls by keyboard (#14680)', () => {
  // Commit 4a528a2e3 made the fixed overlay a focusable scroll region so a
  // report taller than max-height: 50vh can be scrolled from the keyboard.
  // Keyboard scrolling here is *native* browser behavior (overflow-y: auto +
  // tabindex=0, no keydown handler), so the regression this guards is the
  // scroll behavior breaking — overflow-y flipped away from auto, or a future
  // keydown handler swallowing the keys — while tabindex/role/aria-label stay
  // intact. Those cases pass the static attribute checks (line ~172) AND the
  // overlay self-scan (scrollable-region-focusable, line ~388), so only an
  // actual key press that moves scrollTop catches them.
  for (const key of ['PageDown', 'ArrowDown']) {
    test(`html — focused overlay scrolls on ${key}`, async ({ page }) => {
      await page.goto('/html/axe-overlay-scroll.html', { waitUntil: 'networkidle' });

      const axeReport = page.locator('.quarto-axe-report');
      await expect(axeReport).toBeVisible({ timeout: 10000 });

      // Precondition: the fixture must inflate the report past its max-height,
      // or there is nothing to scroll and a green result would be meaningless.
      const overflow = await axeReport.evaluate(
        (el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }),
      );
      expect(
        overflow.scrollHeight,
        `overlay must overflow to be scrollable (scrollHeight ${overflow.scrollHeight} ` +
          `must exceed clientHeight ${overflow.clientHeight}); check axe-overlay-scroll.qmd`,
      ).toBeGreaterThan(overflow.clientHeight);

      // Start from the top and put focus on the overlay itself. toBeFocused is
      // test hygiene: it proves the key goes to the overlay, not the document,
      // so a scrollTop change can only mean the overlay scrolled.
      await axeReport.evaluate((el) => { el.scrollTop = 0; });
      await axeReport.focus();
      await expect(axeReport).toBeFocused();

      await page.keyboard.press(key);

      // Native key scroll is instant, but poll to avoid any timing race.
      await expect
        .poll(() => axeReport.evaluate((el) => el.scrollTop), { timeout: 3000 })
        .toBeGreaterThan(0);
    });
  }
});
