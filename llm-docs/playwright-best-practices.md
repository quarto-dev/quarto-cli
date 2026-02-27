---
main_commit: ee0f68be1
analyzed_date: 2026-02-27
key_files:
  - tests/integration/playwright/tests/axe-accessibility.spec.ts
  - tests/integration/playwright/tests/html-math-katex.spec.ts
---

# Playwright Testing Best Practices

Best practices for writing reliable, maintainable Playwright tests in Quarto CLI, derived from comprehensive test development (axe-accessibility.spec.ts, 431 lines, 75 test cases across 3 formats).

## Web-First Assertions

**Always use Playwright's web-first assertions** - they auto-retry and are more reliable than imperative DOM queries.

### Text Content

```typescript
// ✅ Good - auto-retrying, declarative
await expect(element).toContainText('expected text');

// ❌ Bad - imperative, no auto-retry
const text = await element.textContent();
expect(text).toContain('expected text');
```

### Element Presence

```typescript
// ✅ Good - built-in waiting
await expect(element).toBeAttached();
await expect(element).toBeVisible();

// ❌ Bad - manual DOM check
const isAttached = await page.evaluate(() =>
  document.querySelector('.element') !== null
);
expect(isAttached).toBe(true);
```

### CSS Properties

```typescript
// ✅ Good - direct assertion with auto-retry
await expect(element).toHaveCSS('background-color', 'rgb(255, 0, 0)');
await expect(element).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

// ❌ Bad - manual getComputedStyle
const bgColor = await element.evaluate(el =>
  window.getComputedStyle(el).backgroundColor
);
expect(bgColor).toBe('rgb(255, 0, 0)');
```

### Waiting for Elements

```typescript
// ✅ Good - use locator methods
await element.waitFor({ state: 'visible' });
await element.waitFor({ state: 'attached', timeout: 10000 });

// ❌ Bad - page-level selector waiting
await page.waitForSelector('.element');
```

### Why Web-First Assertions?

Web-first assertions automatically retry until:
- The condition is met (test passes)
- Timeout occurs (test fails with clear error)

This handles timing issues gracefully without manual `waitFor()` calls or fixed delays.

**Real-world impact from PR #14125:** Converting from imperative checks to web-first assertions eliminated multiple race conditions in cross-format testing where different formats loaded at different speeds.

## Role-Based Selectors

**Prefer semantic role-based selectors** over CSS attribute selectors.

### Interactive Elements

```typescript
// ✅ Good - semantic, resilient to markup changes
await page.getByRole('tab', { name: 'Page 2' }).click();
await page.getByRole('button', { name: 'Toggle sidebar' }).click();
await page.getByRole('heading', { name: 'Title' }).isVisible();
await page.getByRole('navigation').locator('a', { hasText: 'Home' }).click();

// ❌ Bad - fragile, coupled to implementation
await page.locator('a[data-bs-target="#page-2"]').click();
await page.locator('.collapse-toggle').click();
await page.locator('h1.title').isVisible();
await page.locator('nav a:has-text("Home")').click();
```

### When to Use CSS Selectors

Role-based selectors aren't always possible. Use CSS selectors for:
- Custom components without ARIA roles
- Testing implementation-specific classes (e.g., `.quarto-axe-report`)
- Dynamic content where role/name combinations are too generic

```typescript
// Acceptable - testing specific implementation class
await page.locator('.quarto-axe-report').toBeVisible();

// Acceptable - no semantic role exists
await page.locator('section.quarto-axe-report-slide').toBeAttached();
```

### Why Role-Based Selectors?

1. **Readability:** `getByRole('tab', { name: 'Page 2' })` is self-documenting
2. **Accessibility:** If the selector works, the element is accessible
3. **Resilience:** CSS classes and attributes change; roles and labels are stable contracts
4. **Maintenance:** Easier to understand intent when reviewing tests

**Real-world impact from PR #14125:** Dashboard rescan tests (8 test cases) initially used CSS attribute selectors like `a[data-bs-target="#page-2"]`. Refactoring to role-based selectors made tests readable without opening the HTML fixtures.

## Handling Non-Unique Selectors

When external tools produce selectors you don't control (e.g., axe-core returning generic "span"), use `.first()` with explanatory comments.

### Pattern

```typescript
// ✅ Good - explicit about why .first() is used
// Use .first() since axe-core may produce non-unique selectors (e.g., "span").
// This tests integration (hover triggers highlight) not selector uniqueness.
const element = page.locator(selector).first();
await expect(element).toHaveClass(/quarto-axe-hover-highlight/);

// ❌ Bad - no explanation, unclear intent
const element = page.locator(selector).first();
await expect(element).toHaveClass(/quarto-axe-hover-highlight/);
```

### When to Use `.first()`

Use when:
- External tools generate selectors you don't control
- Test focuses on interaction/integration, not selector precision
- Selector is known to match multiple elements, but you only care about one

**Always add comments** explaining:
1. Why the selector may be non-unique (e.g., "axe-core produces generic selectors")
2. What the test is actually verifying (e.g., "hover triggers highlight, not selector uniqueness")

### Why Not Fix the Selector?

In integration tests, you're often verifying end-to-end behavior with third-party libraries. The test validates that your integration code works correctly, not that the third-party library produces optimal selectors.

**Real-world example from PR #14125:**

```typescript
// axe-core returns CSS selectors like "span" for violations
// We test: "when hovering violation target, does page element get highlighted?"
// We don't test: "does axe produce unique selectors?" (that's axe's job)

const target = reportSlide.locator('.quarto-axe-violation-target').first();
await target.hover();

// Use .first() since axe-core may produce non-unique selectors (e.g., "span").
// This tests integration (hover triggers highlight) not selector uniqueness.
const element = page.locator(selector).first();
await expect(element).toHaveClass(/quarto-axe-hover-highlight/);
```

## Async Completion Signals

For tests that wait for async operations (network requests, library initialization, processing), add deterministic completion signals instead of arbitrary delays or polling.

### Pattern

```typescript
// In application code:
async function init() {
  try {
    await loadLibrary();
    await processContent();
  } catch (error) {
    console.error('Initialization failed:', error);
  } finally {
    // Always set completion signal, even if work fails
    document.body.setAttribute('data-feature-complete', 'true');
  }
}

// In test:
await page.goto('/page.html');
await page.waitForSelector('[data-feature-complete]', { timeout: 15000 });

// Now you can safely assert on the results
await expect(page.locator('.result')).toBeVisible();
```

### Error Handling

The signal should **always** be set, even on failure:

```typescript
// ✅ Good - completion signal set in finally block
async function processData() {
  try {
    await doAsyncWork();
  } catch (error) {
    console.error('Processing failed:', error);
  } finally {
    document.body.setAttribute('data-processing-complete', 'true');
  }
}

// ❌ Bad - signal only set on success
async function processData() {
  try {
    await doAsyncWork();
    document.body.setAttribute('data-processing-complete', 'true');
  } catch (error) {
    console.error('Processing failed:', error);
  }
}
```

### Why Not Use Fixed Delays?

```typescript
// ❌ Bad - arbitrary delay, may be too short or unnecessarily long
await page.goto('/page.html');
await page.waitForTimeout(5000);  // Hope 5 seconds is enough?

// ✅ Good - deterministic, completes as soon as ready
await page.goto('/page.html');
await page.waitForSelector('[data-feature-complete]', { timeout: 15000 });
```

### Why Completion Signals?

1. **Deterministic:** Test knows exactly when async work is done
2. **Fast:** No waiting longer than necessary
3. **Clear failures:** Timeout means "work never completed" not "maybe we didn't wait long enough"
4. **Debuggable:** Missing attribute = work didn't finish or crashed

**Real-world impact from PR #14125:** The axe accessibility tests initially had race conditions where tests would sometimes pass/fail depending on axe-core's CDN load speed. Adding `data-quarto-axe-complete` in a finally block made tests deterministic - they wait exactly as long as needed and fail clearly if axe never initializes.

### Advanced: Generation Counters for Rescanning

When operations can be triggered multiple times (e.g., rescanning on navigation), use generation counters to discard stale results:

```typescript
let scanGeneration = 0;

async function rescan() {
  const currentGeneration = ++scanGeneration;

  try {
    const results = await performScan();

    // Discard stale results if user triggered another scan
    if (currentGeneration !== scanGeneration) {
      return;
    }

    updateUI(results);
  } finally {
    // Only set completion for latest scan
    if (currentGeneration === scanGeneration) {
      document.body.setAttribute('data-scan-complete', 'true');
    }
  }
}
```

**From PR #14125 dashboard rescan:** Users can switch tabs/pages faster than axe scans complete. Generation counters ensure old scans don't overwrite newer results.

## Parameterized Tests

When testing the same behavior across multiple formats or configurations, use `test.describe` with a test cases array instead of separate spec files.

### Pattern

```typescript
interface TestCase {
  format: string;
  url: string;
  expectedViolation?: string;
  shouldFail?: string;  // Reason for expected failure
}

const testCases: TestCase[] = [
  { format: 'html', url: '/html/feature.html', expectedViolation: 'color-contrast' },
  { format: 'revealjs', url: '/revealjs/feature.html', expectedViolation: 'link-name' },
  {
    format: 'dashboard',
    url: '/dashboard/feature.html',
    shouldFail: 'Dashboard has no <main> element (#13781)'
  },
];

test.describe('Feature across formats', () => {
  for (const { format, url, expectedViolation, shouldFail } of testCases) {
    test(`${format} — feature detects ${expectedViolation}`, async ({ page }) => {
      if (shouldFail) {
        test.fail();  // Mark as expected failure
      }

      await page.goto(url);
      // Shared test logic
    });
  }
});
```

### When to Use Parameterized Tests

Use when:
- Same assertion logic applied to multiple formats (html, revealjs, dashboard, pdf)
- Testing multiple output modes (console, json, document)
- Testing across configurations (themes, options, feature flags)

**Benefits:**
- Reduces file count (1 spec file instead of 3-10)
- Centralizes shared helpers
- Easy to add new test cases
- Clear comparison of format differences

**From PR #14125:** axe-accessibility.spec.ts tests 3 formats × 3 output modes = 9 base cases in a single 431-line file instead of 9 separate spec files.

### Expected Failures with test.fail()

Mark known failures explicitly:

```typescript
test('Feature that is broken in revealjs', async ({ page }) => {
  // RevealJS doesn't support this yet (#13781)
  test.fail();

  // Normal test logic - if this unexpectedly passes, Playwright will flag it
  await page.goto('/revealjs/feature.html');
  await expect(page.locator('.feature')).toBeVisible();
});
```

**Why use test.fail():**
- Documents known issues in test suite
- Test passes when it fails (expected behavior)
- Test **fails** if it unexpectedly passes (signals the bug is fixed)
- Better than commenting out tests or skipping with test.skip()

## Summary

**Four key patterns for reliable Playwright tests:**

1. **Web-first assertions** - `expect(el).toContainText()` not `expect(await el.textContent())`
2. **Role-based selectors** - `getByRole('tab', { name: 'Page 2' })` not `locator('a[data-bs-target]')`
3. **Explicit .first() comments** - Explain why and what you're testing
4. **Completion signals** - `data-feature-complete` in finally blocks, not arbitrary delays

These patterns emerged from building comprehensive cross-format test coverage and debugging race conditions. They make tests:
- More reliable (fewer flaky failures)
- More readable (intent is clear)
- Easier to maintain (resilient to markup changes)
- Faster to debug (clear failure modes)

**Reference implementations:**
- `tests/integration/playwright/tests/axe-accessibility.spec.ts` - 431 lines, 75 test cases
- `tests/integration/playwright/tests/html-math-katex.spec.ts` - Parameterized format testing
