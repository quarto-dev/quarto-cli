import { expect, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Math in cross-reference popups must be typeset, including when the target
// is in another chapter and the referencing page has no math of its own (so
// it loads no math library), and when MathJax 4 needs to load font data
// first (e.g. for \mathcal) before it can typeset.

const books = [
  { method: "MathJax", dir: "book/xref-hover-math", rendered: "mjx-container" },
  { method: "KaTeX", dir: "book/xref-hover-math-katex", rendered: ".katex" },
];

const pages = [
  {
    page: "with-math.html",
    refs: ["Chapter 1", "Section 1.1", "Equation 1.1", "Equation 2.1"],
  },
  { page: "no-math.html", refs: ["Chapter 1", "Section 1.1", "Equation 1.1"] },
];

for (const { method, dir, rendered } of books) {
  test.describe(`${method} math in cross-reference popups`, () => {
    for (const { page: pageName, refs } of pages) {
      for (const ref of refs) {
        test(`${ref} from ${pageName}`, async ({ page }) => {
          await page.goto(getUrl(`${dir}/_book/${pageName}`), {
            waitUntil: "load",
          });
          await page.locator("main a.quarto-xref", { hasText: ref }).hover();

          const popup = page.locator(".tippy-box");
          await expect(popup).toBeVisible();
          // chapter and section previews hold several formulas; any typeset one
          // shows the library ran on the preview
          await expect(popup.locator(rendered).first()).toBeVisible({
            timeout: 15000,
          });
          // no raw TeX left between \( \) or \[ \] delimiters
          await expect(popup).not.toContainText(/\\[([]/);
        });
      }
    }
  });
}

// #15194: footnote popups took the footnote's HTML when the page loaded and
// never typeset it, so math showed as raw TeX whenever MathJax hadn't reached
// the footnote yet (e.g. while loading font data for \mathcal).
test.describe("MathJax math in footnote popups", () => {
  for (const ref of ["1", "2"]) {
    test(`footnote ${ref}`, async ({ page }) => {
      await page.goto(getUrl("html/hover-math-footnotes.html"), {
        waitUntil: "load",
      });
      await page.locator('a[role="doc-noteref"]', { hasText: ref }).hover();

      const popup = page.locator(".tippy-box");
      await expect(popup).toBeVisible();
      await expect(popup.locator("mjx-container")).toBeVisible({
        timeout: 15000,
      });
      await expect(popup).not.toContainText(/\\[([]/);
    });
  }
});
