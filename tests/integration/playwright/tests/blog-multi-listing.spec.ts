import { expect, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression test for https://github.com/quarto-dev/quarto-cli/issues/14493:
// when a post is in multiple listings, the post's category link must target
// the nearest parent listing, not just the first entry in listings.json.

const fixtureRoot = "blog/multi-listing-blog/_site";
const categoryHrefPattern = (name: string, listing = "blog") =>
  new RegExp(`/${listing}/index\\.html#category=${name}$`);

const categoryLinkLocator = (page: Page, name: string) =>
  page
    .locator("header.quarto-title-block .quarto-category", { hasText: name })
    .locator("a");

// A full render writes the blog listing first in listings.json, while an
// incremental render or `quarto preview` can write the homepage listing first.
// The link must not depend on that order.
const listingOrders = [
  { name: "rendered listing order", homepageFirst: false },
  { name: "homepage listing first", homepageFirst: true },
];

const serveListings = async (page: Page, homepageFirst: boolean) => {
  if (!homepageFirst) {
    return;
  }
  await page.route("**/listings.json", async (route) => {
    const response = await route.fetch();
    const listings: { listing: string }[] = await response.json();
    const isHomepage = (entry: { listing: string }) =>
      entry.listing === "/index.html";
    await route.fulfill({
      response,
      json: [
        ...listings.filter(isHomepage),
        ...listings.filter((entry) => !isHomepage(entry)),
      ],
    });
  });
};

for (const { name, homepageFirst } of listingOrders) {
  test.describe(name, () => {
    test.beforeEach(async ({ page }) => {
      await serveListings(page, homepageFirst);
    });

    test("Category link on a post filters the nearest parent listing", async ({ page }) => {
      await page.goto(`./${fixtureRoot}/blog/post-one/`);

      // Only "Post one" carries `beta`, so the filter must hide "Post two".
      await expect(categoryLinkLocator(page, "beta")).toHaveAttribute(
        "href",
        categoryHrefPattern("beta"),
      );

      await categoryLinkLocator(page, "beta").click();
      await expect(page).toHaveURL(
        getUrl(`${fixtureRoot}/blog/index.html#category=beta`),
      );
      await expect(
        page.locator(
          `div.category[data-category="${btoa(encodeURIComponent("beta"))}"]`,
        ),
      ).toHaveClass(/active/);
      await expect(page.getByRole("link", { name: "Post one", exact: true }))
        .toBeVisible();
      await expect(page.getByRole("link", { name: "Post two", exact: true }))
        .toBeHidden();
    });

    test("Category link on a post does not point at the homepage listing", async ({ page }) => {
      // Reach the post from the homepage so document.referrer points at the
      // homepage listing.
      await page.goto(`./${fixtureRoot}/`);
      await page.getByRole("link", { name: "Post one", exact: true }).click();
      await expect(page).toHaveURL(getUrl(`${fixtureRoot}/blog/post-one/`));

      await expect(categoryLinkLocator(page, "alpha")).toHaveAttribute(
        "href",
        categoryHrefPattern("alpha"),
      );
    });

    test("Category link on a post with only the site listing above it follows the referrer listing", async ({ page }) => {
      // "Note one" sits under notes/, which has no listing of its own, so the
      // only ancestor listing is the site root. The reader came from Topics,
      // which lists the note, so its categories should filter Topics.
      await page.goto(`./${fixtureRoot}/topics/`);
      await page.getByRole("link", { name: "Note one", exact: true }).click();
      await expect(page).toHaveURL(getUrl(`${fixtureRoot}/notes/note-one/`));

      await expect(categoryLinkLocator(page, "gamma")).toHaveAttribute(
        "href",
        categoryHrefPattern("gamma", "topics"),
      );
    });
  });
}
