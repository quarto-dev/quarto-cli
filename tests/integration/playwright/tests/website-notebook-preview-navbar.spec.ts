import { expect, test, type Locator } from "@playwright/test";

// True when the element at the center of `locator` belongs to it, i.e. no
// other element (such as a fixed navbar) is painted on top of it.
async function isTopmostAtCenter(locator: Locator): Promise<boolean> {
  return await locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    return hit !== null && el.contains(hit);
  });
}

// On a website with a navbar, the notebook preview page has two fixed-top
// headers: the site navbar and the notebook preview header. The preview
// header controls must stay visible and clickable (#14972).
test("notebook preview header is not hidden by the website navbar", async ({ page }) => {
  await page.goto("./website/notebook-preview-navbar/_site/notebook-preview.html");

  const navbar = page.locator("#quarto-header");
  const embedHeader = page.locator("#quarto-embed-header");
  await expect(navbar).toBeVisible();
  await expect(embedHeader).toBeVisible();

  const backLink = embedHeader.locator(".quarto-back-link");
  const title = embedHeader.locator("h6");
  const download = embedHeader.getByRole("link", { name: "Download Notebook" });

  const controls = { "back link": backLink, title, "download link": download };
  for (const [name, control] of Object.entries(controls)) {
    await expect(control).toBeVisible();
    expect(await isTopmostAtCenter(control), `${name} is covered by another element`).toBe(true);
  }
});
