import { expect, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

const testPages = {
  'posts': 'table.html',
};

test("toc navigation doesn't crash", async ({ page }) => {
  const messages: string[] = [];
  page.on('pageerror', (error) => {
    messages.push(`[${error.name}] ${error.message}`);
  });
  await page.goto('./blog/simple-blog/_site/posts/post-with-code/index.html');
  expect(messages).toStrictEqual([]); 
});

// Regression tests for #15297. quarto.js resolves each TOC link's
// data-scroll-target to its section. An id with a "%" that does not start a
// valid escape made decodeURI throw, which stopped the scroll tracking for
// the whole page. An id that decodes to a different one, or that contains a
// colon (escaped as "\:" in data-scroll-target), was never found, so its TOC
// entry was never highlighted.
test.describe("TOC highlighting with special characters in heading ids", () => {
  const sections = [
    { id: "bad%zz", name: "Invalid percent escape" },
    { id: "bad%20ok", name: "Valid percent escape" },
    { id: "with:colon", name: "Colon" },
  ];

  const tocLink = (page: Page, name: string) =>
    page.locator("nav#TOC").getByRole("link", { name, exact: true });

  test("loading the page raises no error", async ({ page }) => {
    const messages: string[] = [];
    page.on("pageerror", (error) => {
      messages.push(`[${error.name}] ${error.message}`);
    });
    await page.goto(getUrl("html/toc-scroll-target-ids.html"));
    await expect(tocLink(page, "Plain")).toHaveClass(/active/);
    expect(messages).toStrictEqual([]);
  });

  for (const { id, name } of sections) {
    test(`scrolling to the "${id}" section highlights its TOC entry`, async ({
      page,
    }) => {
      await page.goto(getUrl("html/toc-scroll-target-ids.html"));
      await expect(tocLink(page, "Plain")).toHaveClass(/active/);

      // quarto.js compares the scroll position with the section's offsetTop.
      await page.evaluate((id) => {
        window.scrollTo(0, document.getElementById(id)!.offsetTop);
      }, id);

      await expect(tocLink(page, name)).toHaveClass(/active/);
      await expect(tocLink(page, "Plain")).not.toHaveClass(/active/);
    });
  }
});
