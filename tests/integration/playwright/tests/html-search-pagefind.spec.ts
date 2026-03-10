import { test, expect } from "@playwright/test";

const BASE = "./html/search-pagefind/_site/index.html";

test("Pagefind search returns results for indexed content", async ({
  page,
}) => {
  await page.goto(BASE);

  // Open search overlay
  await page.locator("#quarto-search").getByRole("button").click();
  const input = page.getByRole("searchbox");
  await expect(input).toBeVisible({ timeout: 5000 });

  // Search for a keyword on the home page
  await input.fill("astrophysics");

  // Wait for search results to appear in the autocomplete panel
  const results = page.locator(".aa-Panel .aa-Item");
  await expect(results.first()).toBeVisible({ timeout: 10000 });

  const count = await results.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test("Pagefind search returns results from other pages", async ({ page }) => {
  await page.goto(BASE);

  await page.locator("#quarto-search").getByRole("button").click();
  const input = page.getByRole("searchbox");
  await expect(input).toBeVisible({ timeout: 5000 });

  // Search for a keyword that only appears on second.qmd
  await input.fill("crystallography");

  const results = page.locator(".aa-Panel .aa-Item");
  await expect(results.first()).toBeVisible({ timeout: 10000 });

  const count = await results.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test("Pagefind search excludes pages with search: false", async ({ page }) => {
  await page.goto(BASE);

  await page.locator("#quarto-search").getByRole("button").click();
  const input = page.getByRole("searchbox");
  await expect(input).toBeVisible({ timeout: 5000 });

  // Search for a keyword that only appears on nosearch.qmd
  await input.fill("xylophone");

  // Wait for the "no results" message to appear
  const noResults = page.locator(".quarto-search-no-results");
  await expect(noResults).toBeVisible({ timeout: 10000 });

  // Verify no result items
  const items = page.locator(".aa-Panel .aa-Item");
  await expect(items).toHaveCount(0);
});

test("Pagefind engine config is present in page", async ({ page }) => {
  await page.goto(BASE);

  const engineValue = await page.evaluate(() => {
    const script = document.getElementById("quarto-search-options");
    if (!script) return null;
    const opts = JSON.parse(script.textContent || "{}");
    return opts.engine;
  });
  expect(engineValue).toBe("pagefind");
});

test("Pagefind files are present in output", async ({ page }) => {
  const response = await page.goto(
    "./html/search-pagefind/_site/pagefind/pagefind.js"
  );
  expect(response?.status()).toBe(200);
});

test("Clicking a search result navigates to the correct page", async ({
  page,
}) => {
  await page.goto(BASE);

  await page.locator("#quarto-search").getByRole("button").click();
  const input = page.getByRole("searchbox");
  await expect(input).toBeVisible({ timeout: 5000 });

  await input.fill("crystallography");

  const results = page.locator(".aa-Panel .aa-Item");
  await expect(results.first()).toBeVisible({ timeout: 10000 });

  // Click the first result link
  await results.first().locator("a").click();

  // Should navigate to second.html
  await expect(page).toHaveURL(/second\.html/, { timeout: 5000 });
});

test("Search result URLs have no double slashes", async ({ page }) => {
  await page.goto(BASE);

  await page.locator("#quarto-search").getByRole("button").click();
  const input = page.getByRole("searchbox");
  await expect(input).toBeVisible({ timeout: 5000 });

  await input.fill("crystallography");

  const results = page.locator(".aa-Panel .aa-Item");
  await expect(results.first()).toBeVisible({ timeout: 10000 });

  // Verify the link href does not contain double slashes (except in protocol)
  const href = await results.first().locator("a").getAttribute("href");
  expect(href).not.toBeNull();
  // Strip protocol, then check for double slashes
  const pathPart = href!.replace(/^https?:\/\//, "");
  expect(pathPart).not.toContain("//");
});

test("Search works after navigating to a result page", async ({ page }) => {
  // Collect page errors to detect JS failures on the target page
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto(BASE);

  // First search: navigate to second.html
  await page.locator("#quarto-search").getByRole("button").click();
  let input = page.getByRole("searchbox");
  await expect(input).toBeVisible({ timeout: 5000 });

  await input.fill("crystallography");

  let results = page.locator(".aa-Panel .aa-Item");
  await expect(results.first()).toBeVisible({ timeout: 10000 });
  // Get the href so we can navigate directly (avoids overlay interaction issues)
  const href = await results.first().locator("a").getAttribute("href");
  expect(href).not.toBeNull();
  expect(href).toMatch(/second\.html/);

  // Navigate to the result page
  await page.goto(href!);
  await page.waitForLoadState("domcontentloaded");

  // Verify no JS errors on the navigated page (e.g. pagefind failing to load)
  expect(
    pageErrors.filter((e) => e.includes("pagefind") || e.includes("Failed to fetch"))
  ).toHaveLength(0);

  // Second search from the new page: search should still work
  const searchButton = page.locator("#quarto-search").getByRole("button");
  await expect(searchButton).toBeVisible({ timeout: 5000 });
  await searchButton.click();
  input = page.getByRole("searchbox");
  await expect(input).toBeVisible({ timeout: 5000 });

  await input.fill("astrophysics");

  results = page.locator(".aa-Panel .aa-Item");
  await expect(results.first()).toBeVisible({ timeout: 10000 });

  const count = await results.count();
  expect(count).toBeGreaterThanOrEqual(1);
});
