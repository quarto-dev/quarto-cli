import { expect, test } from "@playwright/test";

const listingTypes = [
  {
    name: "default",
    page: "index.html",
    containerSelector: ".quarto-listing-default",
    itemAnchorSelector:
      '.quarto-listing-default .listing-title a[href="https://example.com/external-article"]',
    hasIconChecks: true,
  },
  {
    name: "grid",
    page: "grid.html",
    containerSelector: ".quarto-listing-container-grid",
    itemAnchorSelector:
      '.quarto-listing-container-grid a.quarto-grid-link[href="https://example.com/external-article"]',
    hasIconChecks: true,
  },
  {
    name: "table",
    page: "table.html",
    containerSelector: ".quarto-listing-table",
    itemAnchorSelector:
      '.quarto-listing-table a[href="https://example.com/external-article"]',
    hasIconChecks: false,
  },
];

const afterContent = (selector: string) =>
  `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    return el ? getComputedStyle(el, "::after").content : "missing";
  })()`;

listingTypes.forEach(
  ({
    name,
    page,
    containerSelector,
    itemAnchorSelector,
    hasIconChecks,
  }) => {
    test.describe(`External links in ${name} listing`, () => {
      test("External listing item has target=_blank attribute", async ({ page: browserPage }) => {
        await browserPage.goto(`./listings/external-links/_site/${page}`);
        await browserPage.waitForSelector(containerSelector);

        const externalLink = browserPage.locator(itemAnchorSelector);

        await expect(externalLink.first()).toHaveAttribute("target", "_blank");
      });

      test("External listing item has rel=noopener attribute", async ({ page: browserPage }) => {
        await browserPage.goto(`./listings/external-links/_site/${page}`);
        await browserPage.waitForSelector(containerSelector);

        const externalLink = browserPage.locator(itemAnchorSelector);

        await expect(externalLink.first()).toHaveAttribute("rel", "noopener");
      });

      test("item anchor announces the new tab", async ({ page: browserPage }) => {
        await browserPage.goto(`./listings/external-links/_site/${page}`);
        await browserPage.waitForSelector(containerSelector);

        await expect(browserPage.locator(itemAnchorSelector).first())
          .toHaveAccessibleName(/\(opens in a new tab\)$/);
      });

      test("internal item has no target and no announcement", async ({ page: browserPage }) => {
        await browserPage.goto(`./listings/external-links/_site/${page}`);
        await browserPage.waitForSelector(containerSelector);

        const internalLink = browserPage
          .locator(containerSelector)
          .getByRole("link", { name: "Local Post" })
          .first();

        await expect(internalLink).toBeVisible();
        await expect(internalLink).not.toHaveAttribute("target");
        await expect(internalLink.locator(".quarto-ext-newwindow")).toHaveCount(
          0,
        );
      });

      test("listing has no axe-core violations", async ({ page: browserPage }) => {
        await browserPage.goto(`./listings/external-links/_site/${page}`);
        await browserPage.waitForSelector(containerSelector);
        await browserPage.waitForFunction(() => (window as any).axe);

        const violations = await browserPage.evaluate(async (selector) => {
          const axe = (window as any).axe;
          // heading-order judges the listing heading levels against the
          // page, which this test does not cover.
          const result = await axe.run(document.querySelector(selector), {
            rules: { "heading-order": { enabled: false } },
          });
          return result.violations.map(
            (v: { id: string; nodes: { target: string[] }[] }) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            }),
          );
        }, containerSelector);
        expect(violations).toEqual([]);
      });

      if (hasIconChecks) {
        test("item anchor has no external icon", async ({ page: browserPage }) => {
          await browserPage.goto(`./listings/external-links/_site/${page}`);
          await browserPage.waitForSelector(containerSelector);

          // The external-link script sets target; read the style only after it ran.
          await expect(browserPage.locator(itemAnchorSelector).first())
            .toHaveAttribute("target", "_blank");
          expect(
            await browserPage.evaluate(afterContent(itemAnchorSelector)),
          ).toBe("none");
        });

        test("description link keeps its external icon", async ({ page: browserPage }) => {
          await browserPage.goto(`./listings/external-links/_site/${page}`);
          await browserPage.waitForSelector(containerSelector);

          const descriptionLink = browserPage
            .locator(containerSelector)
            .locator('a[href="https://example.org/docs"]');

          await expect(descriptionLink).toHaveClass(/external/);
          const content = await browserPage.evaluate(
            afterContent(
              `${containerSelector} a[href="https://example.org/docs"]`,
            ),
          );
          expect(content).not.toBe("none");
          expect(content).not.toBe("missing");
        });
      }
    });
  },
);

test.describe("External links without link-external-newwindow", () => {
  test("option absent: no target and no announcement", async ({ page: browserPage }) => {
    await browserPage.goto("./listings/external-links/_site/no-newwindow.html");

    const link = browserPage.locator('a[href="https://example.com/outside"]');

    await expect(link).toBeVisible();
    await expect(link).not.toHaveAttribute("target");
    await expect(link.locator(".quarto-ext-newwindow")).toHaveCount(0);
  });
});

test.describe("External links shown after listing updates", () => {
  test("item on page 2 is decorated after pagination", async ({ page: browserPage }) => {
    await browserPage.goto("./listings/external-links/_site/paged.html");
    const listing = browserPage.locator(".quarto-listing-default");
    await browserPage
      .locator("#paged-listing-pagination .page.page-link", { hasText: "2" })
      .click();

    const link = listing.locator('.listing-title a[href="https://example.com/external-article"]');
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAccessibleName(/\(opens in a new tab\)$/);
    await expect(link.locator(".quarto-ext-newwindow")).toHaveCount(1);
  });
});

test.describe("External links in minimal HTML", () => {
  test("new-tab announcement stays visually hidden", async ({ page: browserPage }) => {
    await browserPage.goto("./listings/external-links/_site/minimal.html");

    const note = browserPage.locator('a[href="https://example.com/minimal"] .quarto-ext-newwindow');
    await expect(note).toHaveCount(1);
    const box = await note.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(1);
    expect(box?.height ?? 0).toBeLessThanOrEqual(1);
  });
});

test.describe("Imageless external item in a default listing", () => {
  test("empty thumbnail link is hidden and out of the tab order", async ({ page: browserPage }) => {
    await browserPage.goto("./listings/external-links/_site/index.html");

    const thumbnailLink = browserPage.locator(
      '.quarto-listing-default .thumbnail a[href="https://example.com/external-article"]',
    );

    await expect(thumbnailLink).toHaveAttribute("aria-hidden", "true");
    await expect(thumbnailLink).toHaveAttribute("tabindex", "-1");
  });
});
