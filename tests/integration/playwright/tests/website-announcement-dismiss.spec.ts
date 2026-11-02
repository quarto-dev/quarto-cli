import { expect, test } from "@playwright/test";
import { getUrl, tabUntilFocused } from "../src/utils";

// The dismiss control of a website announcement is a real <button>, so
// keyboard and screen reader users can reach and use it (#15235). It used to
// be a bare <i> icon that only reacted to a mouse click.
//
// The two fixtures cover both template branches (above and below the
// navbar). The below-navbar fixture also sets `announcement-dismiss-label`
// in `language:`, to check that the accessible name can be translated.
const testCases = [
  {
    position: "above-navbar",
    url: "website/announcement-dismiss-above/_site/index.html",
    label: "Dismiss announcement",
  },
  {
    position: "below-navbar",
    url: "website/announcement-dismiss-below/_site/index.html",
    label: "Close this notice",
  },
];

for (const { position, url, label } of testCases) {
  test.describe(`announcement ${position}`, () => {
    test.use({ viewport: { width: 1200, height: 800 } });

    test.beforeEach(async ({ page }) => {
      await page.goto(getUrl(url), { waitUntil: "load" });
      await expect(page.locator("#quarto-announcement")).toBeVisible();
    });

    test("dismiss control is a named button", async ({ page }) => {
      const button = page.getByRole("button", { name: label, exact: true });
      await expect(button).toHaveCount(1);
      await expect(button).toHaveClass(/quarto-announcement-action/);
      await expect(button).toHaveAttribute("type", "button");
      // The icon is decorative; the button carries the name.
      await expect(button.locator("i.bi-x-lg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });

    for (const key of ["Enter", "Space"]) {
      test(`Tab reaches the button and ${key} dismisses`, async ({
        page,
        browserName,
      }) => {
        const button = page.locator("#quarto-announcement .quarto-announcement-action");
        expect(await tabUntilFocused(page, browserName, button)).toBe(true);
        // Keyboard focus shows Quarto's focus ring.
        await expect(button).toHaveCSS("outline-style", "solid");

        await page.keyboard.press(key);
        await expect(page.locator("#quarto-announcement")).toHaveCount(0);

        // The dismissal is remembered, as it is for a mouse click.
        await page.reload({ waitUntil: "load" });
        await expect(page.locator("#quarto-announcement")).toHaveCount(0);
      });
    }

    test("mouse click still dismisses", async ({ page }) => {
      await page.locator("#quarto-announcement .quarto-announcement-action").click();
      await expect(page.locator("#quarto-announcement")).toHaveCount(0);
    });
  });
}

// A button centers its content vertically, so in a wrapped announcement the
// icon would drop to the middle of the bar; it stays aligned with the first
// line of text, as the bare icon was.
test.describe("wrapped announcement", () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test("dismiss icon stays at the top of the bar", async ({ page }) => {
    await page.goto(
      getUrl("website/announcement-dismiss-below/_site/index.html"),
      { waitUntil: "load" },
    );
    const content = page.locator("#quarto-announcement .quarto-announcement-content");
    const icon = page.locator("#quarto-announcement .quarto-announcement-action i");
    const contentBox = await content.boundingBox();
    const iconBox = await icon.boundingBox();
    // The text wraps, so the bar is taller than one icon.
    expect(contentBox!.height).toBeGreaterThan(2 * iconBox!.height);
    expect(Math.abs(iconBox!.y - contentBox!.y)).toBeLessThan(2);
  });
});
