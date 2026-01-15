import { test, expect } from "@playwright/test";

const listingTypes = [
  {
    name: "default",
    page: "index.html",
    containerSelector: ".quarto-listing-default",
    externalLinkSelector:
      '.quarto-listing-default a[href="https://example.com/external-article"]',
  },
  {
    name: "grid",
    page: "grid.html",
    containerSelector: ".quarto-listing-container-grid",
    externalLinkSelector:
      '.quarto-listing-container-grid a[href="https://example.com/external-article"]',
  },
  {
    name: "table",
    page: "table.html",
    containerSelector: ".quarto-listing-table",
    externalLinkSelector:
      '.quarto-listing-table a[href="https://example.com/external-article"]',
  },
];

listingTypes.forEach(({ name, page, containerSelector, externalLinkSelector }) => {
  test.describe(`External links in ${name} listing`, () => {
    test("External listing item has target=_blank attribute", async ({
      page: browserPage,
    }) => {
      await browserPage.goto(`./listings/external-links/_site/${page}`);

      // Wait for the listing to be visible
      await browserPage.waitForSelector(containerSelector);

      // Find the link to the external article
      const externalLink = browserPage.locator(externalLinkSelector);

      await expect(externalLink.first()).toHaveAttribute("target", "_blank");
    });

    test("External listing item has rel=noopener attribute", async ({
      page: browserPage,
    }) => {
      await browserPage.goto(`./listings/external-links/_site/${page}`);

      // Wait for the listing to be visible
      await browserPage.waitForSelector(containerSelector);

      // Find the link to the external article
      const externalLink = browserPage.locator(externalLinkSelector);

      await expect(externalLink.first()).toHaveAttribute("rel", "noopener");
    });

    test("Internal listing item does NOT have target=_blank attribute", async ({
      page: browserPage,
    }) => {
      await browserPage.goto(`./listings/external-links/_site/${page}`);

      // Wait for the listing to be visible
      await browserPage.waitForSelector(containerSelector);

      // Find the link to the local post by its text content
      const internalLink = browserPage
        .getByRole("link", { name: "Local Post" })
        .first();

      // Verify the link exists
      await expect(internalLink).toBeVisible();

      // Internal links should not have target="_blank"
      await expect(internalLink).not.toHaveAttribute("target", "_blank");
    });
  });
});
