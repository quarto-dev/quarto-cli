import { expect, test } from "@playwright/test";

const newWindowLabel = "(opens in a new tab)";
const newWindowNoteId = "quarto-ext-newwindow-label";

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

        const link = browserPage.locator(itemAnchorSelector).first();
        await expect(link).toHaveAccessibleDescription(newWindowLabel);
        await expect(link).not.toHaveAccessibleName(/opens in a new tab/);
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
        await expect(internalLink).not.toHaveAttribute("aria-describedby");
      });

      test("listing has no axe-core violations", async ({ page: browserPage }) => {
        await browserPage.goto(`./listings/external-links/_site/${page}`);
        await browserPage.waitForSelector(containerSelector);
        await browserPage.waitForFunction(() => (window as any).axe);

        const violations = await browserPage.evaluate(async (selector) => {
          const axe = (window as any).axe;
          const container = document.querySelector(selector)!;
          // A description containing a link splits the item's wrapping <a>,
          // leaving empty links that fail link-name; a separate bug.
          const emptyWrappers = Array.from(
            container.querySelectorAll("a"),
          ).filter((a) => a.children.length === 0 && a.textContent!.trim() === "");
          // heading-order judges the listing heading levels against the
          // page, which this test does not cover.
          const result = await axe.run(
            { include: [container], exclude: emptyWrappers },
            { rules: { "heading-order": { enabled: false } } },
          );
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
    await expect(link).not.toHaveAttribute("aria-describedby");
    await expect(browserPage.locator(`#${newWindowNoteId}`)).toHaveCount(0);
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
    await expect(link).toHaveAccessibleDescription(newWindowLabel);
    await expect(link).toHaveAttribute("aria-describedby", newWindowNoteId);
  });

  test("custom icon is added once across page changes", async ({ page: browserPage }) => {
    await browserPage.goto("./listings/external-links/_site/custom-icon.html");
    const pageLink = (n: string) =>
      browserPage.locator("#custom-icon-listing-pagination .page.page-link", {
        hasText: n,
      });
    const descriptionLink = browserPage.locator(
      '.quarto-listing-default a[href="https://example.org/docs"]',
    );

    for (const n of ["2", "1", "2", "1", "2"]) {
      await pageLink(n).click();
    }
    await expect(descriptionLink).toBeVisible();
    // The icon is inserted as the next sibling of the link it decorates.
    await expect(descriptionLink.locator("xpath=following-sibling::i[contains(@class, 'quarto-ext-icon')]"))
      .toHaveCount(1);
    await expect(descriptionLink).toHaveAttribute("aria-describedby", newWindowNoteId);
  });
});

test.describe("External links in minimal HTML", () => {
  test("new-tab label element stays hidden", async ({ page: browserPage }) => {
    await browserPage.goto("./listings/external-links/_site/minimal.html");

    const link = browserPage.locator('a[href="https://example.com/minimal"]');
    await expect(link).toHaveAccessibleDescription(newWindowLabel);
    await expect(browserPage.locator(`#${newWindowNoteId}`)).toBeHidden();
  });
});

test.describe("New-tab announcement keeps the accessible name", () => {
  const cases = [
    { id: "text", name: "Example A", description: newWindowLabel },
    { id: "img-alt", name: "Example B logo", description: newWindowLabel },
    { id: "img-title", name: "Example C", description: newWindowLabel },
    { id: "empty-label", name: "Example D", description: newWindowLabel },
    {
      id: "labelledby",
      name: "Example E",
      description: `About E ${newWindowLabel}`,
    },
    // No name before the announcement either, so axe still reports link-name.
    { id: "img-no-alt", name: "", description: newWindowLabel },
  ];

  for (const { id, name, description } of cases) {
    test(`${id} link`, async ({ page: browserPage }) => {
      await browserPage.goto("./listings/external-links/_site/names.html");

      const link = browserPage.locator(`#${id}`);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAccessibleName(name);
      await expect(link).toHaveAccessibleDescription(description);
    });
  }
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
