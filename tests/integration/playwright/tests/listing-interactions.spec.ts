import { expect, Page, test } from "@playwright/test";

const fixture = "./listings/interactions/_site/index.html";
const listingIds = ["first-listing", "second-listing"];

const titles = (page: Page, listingId: string) =>
  page.locator(`#listing-${listingId} .list .listing-title`);

const pageLink = (page: Page, listingId: string, n: string) =>
  page.locator(`#${listingId}-pagination .page.page-link`, { hasText: n });

const categoryEl = (page: Page, name: string) =>
  page.locator(".quarto-listing-category .category", { hasText: name });

async function changeHash(page: Page, hash: string) {
  await page.evaluate((hash) =>
    new Promise<void>((resolve) => {
      window.addEventListener("hashchange", () => resolve(), { once: true });
      window.location.hash = hash;
    }), hash);
}

test.describe("Listing categories", () => {
  test("category title click resets the filter", async ({ page }) => {
    await page.goto(fixture);
    await categoryEl(page, "cat3").click();
    await expect(titles(page, "first-listing")).toHaveText(["Post 3"]);

    await page.locator(".quarto-listing-category-title").click();

    await expect(titles(page, "first-listing")).toHaveText(["Post 1"]);
    await expect(page.locator("#first-listing-pagination .page.page-link")).toHaveCount(3);
    await expect(page.locator(".quarto-listing-category .category.active"))
      .toHaveAttribute("data-category", "");
  });

  test("hash change to a category filters the listings", async ({ page }) => {
    await page.goto(fixture);

    await changeHash(page, "category=cat3");

    for (const listingId of listingIds) {
      await expect(titles(page, listingId)).toHaveText(["Post 3"]);
    }
  });

  test("back and forward restore the category", async ({ page }) => {
    await page.goto(fixture);
    await categoryEl(page, "cat3").click();
    await expect(titles(page, "first-listing")).toHaveText(["Post 3"]);
    await categoryEl(page, "cat1").click();
    await expect(titles(page, "first-listing")).toHaveText(["Post 1"]);

    await page.goBack();
    await expect(titles(page, "first-listing")).toHaveText(["Post 3"]);
    await expect(categoryEl(page, "cat3")).toHaveClass(/active/);

    await page.goForward();
    await expect(titles(page, "first-listing")).toHaveText(["Post 1"]);
    await expect(categoryEl(page, "cat1")).toHaveClass(/active/);
  });
});

test.describe("Listing pagination", () => {
  test("page hash on initial load shows that page of that listing only", async ({ page }) => {
    await page.goto(`${fixture}#listing-second-listing-page=2`);

    await expect(titles(page, "second-listing")).toHaveText(["Post 2"]);
    await expect(titles(page, "first-listing")).toHaveText(["Post 1"]);
  });

  test("page links rebuilt after an update still write the page hash", async ({ page }) => {
    await page.goto(fixture);
    await pageLink(page, "second-listing", "2").click();
    await expect(titles(page, "second-listing")).toHaveText(["Post 2"]);

    await pageLink(page, "second-listing", "3").click();

    await expect(titles(page, "second-listing")).toHaveText(["Post 3"]);
    await expect(page).toHaveURL(/#listing-second-listing-page=3$/);
  });

  test("back restores the previous page", async ({ page }) => {
    await page.goto(fixture);
    await pageLink(page, "second-listing", "2").click();
    await expect(titles(page, "second-listing")).toHaveText(["Post 2"]);
    await pageLink(page, "second-listing", "3").click();
    await expect(titles(page, "second-listing")).toHaveText(["Post 3"]);

    await page.goBack();

    await expect(titles(page, "second-listing")).toHaveText(["Post 2"]);
  });
});

test.describe("Listing update side effects", () => {
  test("progressive image gets its src once its page is shown", async ({ page }) => {
    await page.goto(fixture);
    // list.js keeps hidden items out of the DOM; read Post 2 through its item.
    const hiddenImageAttrs = await page.evaluate(() => {
      const list = (window as any)["quarto-listings"]["listing-second-listing"];
      const img = list.items[1].elm.querySelector("img.thumbnail-image");
      return { src: img.getAttribute("src"), dataSrc: img.getAttribute("data-src") };
    });
    expect(hiddenImageAttrs.src).toBeNull();
    expect(hiddenImageAttrs.dataSrc).toMatch(/thumb\.png$/);

    const image = page.locator("#listing-second-listing .list img.thumbnail-image");
    await pageLink(page, "second-listing", "2").click();

    await expect(titles(page, "second-listing")).toHaveText(["Post 2"]);
    await expect(image).toHaveAttribute("src", /thumb\.png$/);
    await expect(image).not.toHaveAttribute("data-src");
  });

  test("no matching message follows the filter", async ({ page }) => {
    await page.goto(fixture);
    const noMatching = page.locator("#listing-first-listing .listing-no-matching");
    const filter = page.locator("#listing-first-listing").getByPlaceholder("Filter");
    await expect(noMatching).toHaveClass(/d-none/);

    // list.js searches on keyup, which fill() alone does not send.
    await filter.fill("nothing matches this");
    await filter.press("Enter");
    await expect(noMatching).not.toHaveClass(/d-none/);

    await filter.fill("");
    await expect(noMatching).toHaveClass(/d-none/);
  });
});
