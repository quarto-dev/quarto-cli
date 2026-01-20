---
paths:
  - "tests/integration/playwright/**/*.spec.ts"
  - "tests/integration/playwright/**/*.ts"
---

# Playwright Tests

Browser-based tests for interactive features. Tests live in `tests/integration/playwright/tests/`.

## Local Development Workflow

**Don't run `playwright-tests.test.ts` locally** - it renders ALL test documents which is slow.

Instead, follow this pattern:

```bash
# 1. Create/edit test documents
#    Location: tests/docs/playwright/<feature>/

# 2. Render the documents you're working on
./package/dist/bin/quarto render tests/docs/playwright/html/tabsets/test.qmd
# on windows
./package/dist/bin/quarto.cmd render tests/docs/playwright/html/tabsets/test.qmd

# 3. Run playwright from the playwright directory
cd tests/integration/playwright
npx playwright test html-tabsets.spec.ts     # Single test
npx playwright test --grep "tabset"          # Filter by name
```

## CI Execution

On CI, tests run via the wrapper which handles rendering:

```bash
./run-tests.sh integration/playwright-tests.test.ts
```

The wrapper (`playwright-tests.test.ts`):

1. Renders all `.qmd` in `docs/playwright/`
2. Installs multiplex server dependencies
3. Runs `npx playwright test`
4. Cleans up rendered output

## Test Structure

Tests use `@playwright/test` framework:

```typescript
import { test, expect } from "@playwright/test";

test("Feature description", async ({ page }) => {
  await page.goto("/html/feature/test.html");

  const element = page.getByRole("tab", { name: "Tab 1" });
  await expect(element).toHaveClass(/active/);
  await element.click();
  await expect(page.locator("div.content")).toBeVisible();
});
```

## Configuration

- **Config file:** `playwright.config.ts`
- **Base URL:** `http://127.0.0.1:8080`
- **Test documents:** `tests/docs/playwright/<feature>/`
- **Test specs:** `tests/integration/playwright/tests/*.spec.ts`

## Web Server

Playwright starts a Python HTTP server automatically when running tests:

```bash
uv run python -m http.server 8080
# Serves from tests/docs/playwright/
```

## Utilities

From `src/utils.ts`:

| Function                           | Purpose                   |
| ---------------------------------- | ------------------------- |
| `getUrl(path)`                     | Build full URL from path  |
| `ojsVal(page, name)`               | Get OJS runtime value     |
| `ojsRuns(page)`                    | Wait for OJS to finish    |
| `checkColor(element, prop, color)` | Verify CSS color          |
| `useDarkLightMode(mode)`           | Set color scheme for test |

## Environment Variables

| Variable                                   | Effect                             |
| ------------------------------------------ | ---------------------------------- |
| `QUARTO_PLAYWRIGHT_TESTS_SKIP_RENDER`      | Skip rendering (use existing HTML) |
| `QUARTO_PLAYWRIGHT_TESTS_SKIP_CLEANOUTPUT` | Keep rendered files after test     |
