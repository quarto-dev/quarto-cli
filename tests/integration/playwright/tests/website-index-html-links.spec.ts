import { expect, test } from "@playwright/test";

// quarto-nav.js rewrites every link on page load to clean up index.html
// URLs. The rewrite must only strip index.html at the end of the path
// (optionally followed by a query or fragment); hrefs that merely start
// with index.html — like the index.html.md markdown twins generated for
// llms.txt workflows — must be left alone (#14667).
test("index.html clean-URL rewrite only strips whole path segments", async ({ page }) => {
  await page.goto("./website/issue-14667/_site/index.html");

  // data-original-href is stamped by the rewrite loop, so waiting on it
  // ensures quarto-nav.js has processed the links
  const mdLink = page.locator("#lnk-md");
  await expect(mdLink).toHaveAttribute("data-original-href", /\/index\.html\.md$/);

  // a link to an index.html-prefixed file must not be rewritten
  await expect(mdLink).toHaveAttribute("href", /\/index\.html\.md$/);

  // ...while genuine index.html links still get cleaned up
  await expect(page.locator("#lnk-clean")).toHaveAttribute("href", /\/sub\/$/);
  await expect(page.locator("#lnk-frag")).toHaveAttribute("href", /\/_site\/#section$/);
  await expect(page.locator("#lnk-query")).toHaveAttribute("href", /\/_site\/\?a=1$/);

  // index.html as an intermediate path segment is not the index page of
  // the link's directory, so it must be left alone too
  await expect(page.locator("#lnk-segment")).toHaveAttribute("href", /\/index\.html\/foo$/);
});
