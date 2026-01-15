import { test, expect } from "@playwright/test";

test.describe("External links in default listing", () => {
  test("External listing item has target=_blank attribute", async ({ page }) => {
    await page.goto("./listings/external-links/_site/index.html");

    // Find the link to the external article in the default listing
    const externalLink = page.locator(
      '.quarto-listing-default a[href="https://example.com/external-article"]'
    );

    await expect(externalLink.first()).toHaveAttribute("target", "_blank");
  });

  test("External listing item has rel=noopener attribute", async ({ page }) => {
    await page.goto("./listings/external-links/_site/index.html");

    // Find the link to the external article in the default listing
    const externalLink = page.locator(
      '.quarto-listing-default a[href="https://example.com/external-article"]'
    );

    await expect(externalLink.first()).toHaveAttribute("rel", "noopener");
  });

  test("Internal listing item does NOT have target=_blank attribute", async ({
    page,
  }) => {
    await page.goto("./listings/external-links/_site/index.html");

    // Wait for the listing to be visible
    await page.waitForSelector(".quarto-listing-default");

    // Find the link to the local post by its text content
    const internalLink = page.getByRole("link", { name: "Local Post" }).first();

    // Verify the link exists
    await expect(internalLink).toBeVisible();

    // Internal links should not have target="_blank"
    await expect(internalLink).not.toHaveAttribute("target", "_blank");
  });
});
