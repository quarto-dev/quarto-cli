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
  await page.waitForSelector('[data-quarto-axe-complete]', { timeout });
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

  // Dashboard — axe-check.js loads as standalone module, falls back to document.body (#13781)
  { format: 'dashboard', outputMode: 'document', url: '/dashboard/axe-accessibility.html',
    expectedViolation: 'color-contrast' },
];

// -- Tests --

test.describe('Axe accessibility checking', () => {
  for (const { format, outputMode, url, expectedViolation } of testCases) {
    test(`${format} — ${outputMode} mode detects ${expectedViolation} violation`, async ({ page }) => {
      if (outputMode === 'document') {
        await page.goto(url, { waitUntil: 'networkidle' });
        const axeReport = page.locator('.quarto-axe-report');
        await expect(axeReport).toBeVisible({ timeout: 10000 });
        const reportText = await axeReport.textContent();
        // Document reporter shows violation descriptions, not IDs.
        // Map violation IDs to expected text in the report.
        const expectedText = expectedViolation === 'color-contrast'
          ? 'color contrast'
          : 'discernible text';
        expect(reportText).toContain(expectedText);

      } else if (outputMode === 'console') {
        const messages = await collectConsoleLogs(page);
        await page.goto(url, { waitUntil: 'networkidle' });
        await waitForAxeCompletion(page);
        const expectedText = expectedViolation === 'color-contrast'
          ? 'contrast'
          : 'discernible text';
        expect(messages.some(m => m.toLowerCase().includes(expectedText))).toBe(true);

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
