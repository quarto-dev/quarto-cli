import { expect, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression test for https://github.com/quarto-dev/quarto-cli/issues/14493:
// when a post is in multiple listings, the post's category link must target
// the nearest parent listing, not just the first entry in listings.json.

const fixtureRoot = "blog/multi-listing-blog/_site";
const categoryHrefPattern = (name: string, listing = "blog/index") =>
  new RegExp(`/${listing}\\.html#category=${name}$`);

const categoryLinkLocator = (page: Page, name: string) =>
  page
    .locator("header.quarto-title-block .quarto-category", { hasText: name })
    .locator("a");

// The order of listings.json depends on how the site was rendered, so each
// case serves an explicit order. The link must not depend on that order.
// Both put the blog listing before the archive, so the first of two listings
// in the same directory is never the expected one.
const listingOrders = [
  {
    name: "homepage listing last",
    order: [
      "/blog/index.html",
      "/blog/archive.html",
      "/topics/index.html",
      "/index.html",
    ],
  },
  {
    name: "homepage listing first",
    order: [
      "/index.html",
      "/blog/index.html",
      "/blog/archive.html",
      "/topics/index.html",
    ],
  },
];

const serveListings = async (page: Page, order: string[]) => {
  await page.route("**/listings.json", async (route) => {
    const response = await route.fetch();
    const listings: { listing: string }[] = await response.json();
    const rank = (entry: { listing: string }) => order.indexOf(entry.listing);
    await route.fulfill({
      response,
      json: [...listings].sort((a, b) => rank(a) - rank(b)),
    });
  });
};

for (const { name, order } of listingOrders) {
  test.describe(name, () => {
    test.beforeEach(async ({ page }) => {
      await serveListings(page, order);
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
        categoryHrefPattern("gamma", "topics/index"),
      );
    });

    test("Category link on a post follows the referrer among listings in the same directory", async ({ page }) => {
      // blog/index.html and blog/archive.html both list "Post two" from the
      // same directory, so neither is nearer; the reader came from Archive.
      await page.goto(`./${fixtureRoot}/blog/archive.html`);
      await page.getByRole("link", { name: "Post two", exact: true }).click();
      await expect(page).toHaveURL(getUrl(`${fixtureRoot}/blog/post-two/`));

      await expect(categoryLinkLocator(page, "alpha")).toHaveAttribute(
        "href",
        categoryHrefPattern("alpha", "blog/archive"),
      );
    });
  });
}
