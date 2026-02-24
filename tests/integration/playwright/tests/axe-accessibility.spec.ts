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
  shouldFail?: string; // reason for test.fail(), undefined if test should pass
}

const testCases: AxeTestCase[] = [
  // HTML — all modes work (bootstrap loads axe-check.js, has <main>)
  { format: 'html', outputMode: 'document', url: '/html/axe-accessibility.html' },
  { format: 'html', outputMode: 'console', url: '/html/axe-console.html' },
  { format: 'html', outputMode: 'json', url: '/html/axe-json.html' },

  // RevealJS — axe-check.js never loads (bundled in bootstrap-only quarto.js) (#13781)
  { format: 'revealjs', outputMode: 'document', url: '/revealjs/axe-accessibility.html',
    shouldFail: 'axe-check.js bundled in quarto.js (bootstrap-only), never loads for revealjs (#13781)' },
  { format: 'revealjs', outputMode: 'console', url: '/revealjs/axe-console.html',
    shouldFail: 'axe-check.js bundled in quarto.js (bootstrap-only), never loads for revealjs (#13781)' },
  { format: 'revealjs', outputMode: 'json', url: '/revealjs/axe-json.html',
    shouldFail: 'axe-check.js bundled in quarto.js (bootstrap-only), never loads for revealjs (#13781)' },

  // Dashboard — axe loads but document reporter fails (no <main> element) (#13781)
  { format: 'dashboard', outputMode: 'document', url: '/dashboard/axe-accessibility.html',
    shouldFail: 'Dashboard has no <main> element; document reporter fails on querySelector("main") (#13781)' },
];

// -- Tests --

test.describe('Axe accessibility checking', () => {
  for (const { format, outputMode, url, shouldFail } of testCases) {
    test(`${format} — ${outputMode} mode detects contrast violation`, async ({ page }) => {
      if (shouldFail) {
        test.fail();
      }

      if (outputMode === 'document') {
        await page.goto(url, { waitUntil: 'networkidle' });
        const axeReport = page.locator('.quarto-axe-report');
        await expect(axeReport).toBeVisible({ timeout: 10000 });
        const reportText = await axeReport.textContent();
        expect(reportText).toContain('color contrast');

      } else if (outputMode === 'console') {
        const messages = await collectConsoleLogs(page);
        await page.goto(url, { waitUntil: 'networkidle' });
        await waitForAxeCompletion(page, shouldFail ? 5000 : 15000);
        expect(messages.some(m => m.toLowerCase().includes('contrast'))).toBe(true);

      } else if (outputMode === 'json') {
        const messages = await collectConsoleLogs(page);
        await page.goto(url, { waitUntil: 'networkidle' });
        await waitForAxeCompletion(page, shouldFail ? 5000 : 15000);
        const result = findAxeJsonResult(messages);
        expect(result).toBeDefined();
        expect(result!.violations.length).toBeGreaterThan(0);
        expect(result!.violations.some(v => v.id === 'color-contrast')).toBe(true);
      }
    });
  }
});
