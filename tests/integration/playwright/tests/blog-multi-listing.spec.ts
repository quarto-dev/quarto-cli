import { expect, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression test for https://github.com/quarto-dev/quarto-cli/issues/14493:
// when a post is in multiple listings, the post's category link must target
// the nearest parent listing, not just the first entry in listings.json.

const fixtureRoot = "blog/multi-listing-blog/_site";
const alphaHrefPattern = /\/blog\/index\.html#category=alpha$/;

const alphaLinkLocator = (page: Page) =>
  page
    .locator("header.quarto-title-block .quarto-category", { hasText: "alpha" })
    .locator("a");

test("Category link on a post resolves to the nearest parent listing", async ({ page }) => {
  await page.goto(`./${fixtureRoot}/blog/post-one/`);

  await expect(alphaLinkLocator(page)).toHaveAttribute("href", alphaHrefPattern);

  await alphaLinkLocator(page).click();
  await expect(page).toHaveURL(
    getUrl(`${fixtureRoot}/blog/index.html#category=alpha`),
  );
  await expect(
    page.locator(
      `div.category[data-category="${btoa(encodeURIComponent("alpha"))}"]`,
    ),
  ).toHaveClass(/active/);
  await expect(page.getByRole("link", { name: "Post one", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Post two", exact: true })).toBeVisible();
});

test("Category link on a post does not point at the homepage listing", async ({ page }) => {
  // Reach the post from the homepage so document.referrer triggers the
  // fallback branch that previously selected the wrong listing.
  await page.goto(`./${fixtureRoot}/`);
  await page.getByRole("link", { name: "Post one", exact: true }).click();
  await expect(page).toHaveURL(getUrl(`${fixtureRoot}/blog/post-one/`));

  await expect(alphaLinkLocator(page)).toHaveAttribute("href", alphaHrefPattern);
});
