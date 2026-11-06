import { test, expect } from "@playwright/test";
import { getUrl } from "../src/utils";

// theme: pandoc renders Pandoc's styles.html. Its print block must win over
// the screen colors set by linkcolor and monobackgroundcolor.
const url = getUrl("html/pandoc-theme-print.html");

test("theme: pandoc — screen uses the document color variables", async ({ page }) => {
  await page.goto(url);
  await expect(page.locator("p a")).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(page.locator("p code")).toHaveCSS("background-color", "rgb(238, 238, 238)");
});

test("theme: pandoc — print resets link, blockquote and code styles", async ({ page }) => {
  await page.emulateMedia({ media: "print" });
  await page.goto(url);
  await expect(page.locator("p a")).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator("blockquote")).toHaveCSS("color", "rgb(0, 0, 0)");
  const code = page.locator("p code");
  await expect(code).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(code).toHaveCSS("padding-left", "0px");
});
