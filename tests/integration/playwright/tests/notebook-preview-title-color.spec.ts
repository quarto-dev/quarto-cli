import { expect, test, type Locator, type Page } from "@playwright/test";
import { checkColorIdentical } from "../src/utils";

// The notebook preview header is painted with the theme's primary background,
// so its title must use the same contrasting text color as the header's
// buttons. A theme with a custom $headings-color used to leak that color onto
// the title, making it hard or impossible to read against the primary
// background while the buttons next to it stayed white.
const testCases = [
  {
    name: "default theme (no custom heading color)",
    dir: "./html/notebook-preview-standalone",
  },
  {
    name: "theme with custom dark heading color (lux)",
    dir: "./html/notebook-preview-theme-dark-heading",
  },
  {
    name: "theme with custom light heading color",
    dir: "./html/notebook-preview-theme-light-heading",
  },
  {
    // cerulean defines a light heading color of its own, but also paints
    // headings white inside .bg-primary containers, so the title must stay
    // white rather than regressing to the theme heading color
    name: "theme that already compensates heading colors on .bg-primary (cerulean)",
    dir: "./html/notebook-preview-theme-cerulean",
  },
];

async function bgPrimaryColor(page: Page): Promise<string> {
  // Compute the color the `bg-primary` utility produces for this theme
  return await page.evaluate(() => {
    const probe = window.document.createElement("div");
    probe.className = "bg-primary";
    window.document.body.appendChild(probe);
    const color = window.getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
}

test.describe("Notebook preview title color", () => {
  for (const { name, dir } of testCases) {
    test.describe(name, () => {
      let title: Locator;
      let header: Locator;

      test.beforeEach(async ({ page }) => {
        await page.goto(`${dir}/notebook-preview.html`);
        header = page.locator("#quarto-embed-header");
        title = page.locator("#quarto-embed-title");
        await expect(title).toBeVisible();
      });

      test("title matches the header buttons' contrasting color", async ({ page }) => {
        const backLink = page.locator(".quarto-back-link");
        await expect(backLink).toBeVisible();
        await checkColorIdentical(title, backLink, "color");
      });

      test("header keeps the primary background", async ({ page }) => {
        await expect(header).toHaveCSS(
          "background-color",
          await bgPrimaryColor(page),
        );
      });
    });
  }
});
