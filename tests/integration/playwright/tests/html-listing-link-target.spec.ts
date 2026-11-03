import { expect, test } from "@playwright/test";

const base = "./listings/link-target/_site";

const newWindowLabel = "(opens in a new tab)";
const newWindowNoteId = "quarto-ext-newwindow-label";

const listingTypes = [
  {
    name: "default",
    page: "index.html",
    containerSelector: ".quarto-listing-default",
  },
  {
    name: "grid",
    page: "grid.html",
    containerSelector: ".quarto-listing-container-grid",
  },
  {
    name: "table",
    page: "table.html",
    containerSelector: ".quarto-listing-table",
  },
];

listingTypes.forEach(({ name, page, containerSelector }) => {
  test.describe(`Link target in ${name} listing`, () => {
    test("listing target applies to items", async ({ page: browserPage }) => {
      await browserPage.goto(`${base}/${page}`);
      await browserPage.waitForSelector(containerSelector);

      const link = browserPage
        .locator(`${containerSelector} a[href="https://example.com/a"]`)
        .first();
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener");
    });

    test("item target overrides listing", async ({ page: browserPage }) => {
      await browserPage.goto(`${base}/${page}`);
      await browserPage.waitForSelector(containerSelector);

      const link = browserPage
        .locator(`${containerSelector} a[href$="local-post.html"]`)
        .first();
      await expect(link).toHaveAttribute("target", "_self");
      await expect(link).not.toHaveAttribute("rel");
    });

    test("explicit rel is kept", async ({ page: browserPage }) => {
      await browserPage.goto(`${base}/${page}`);
      await browserPage.waitForSelector(containerSelector);

      const link = browserPage
        .locator(`${containerSelector} a[href="https://example.com/b"]`)
        .first();
      await expect(link).toHaveAttribute("rel", "external");
    });

    test("no target or rel columns or metadata", async ({ page: browserPage }) => {
      await browserPage.goto(`${base}/${page}`);
      await browserPage.waitForSelector(containerSelector);

      await expect(
        browserPage.locator(
          `${containerSelector} .listing-target, ${containerSelector} .listing-rel`,
        ),
      ).toHaveCount(0);
      if (name === "table") {
        const headers = await browserPage
          .locator(`${containerSelector} thead th`)
          .allInnerTexts();
        expect(headers.map((h) => h.trim().toLowerCase())).not.toContain(
          "target",
        );
        expect(headers.map((h) => h.trim().toLowerCase())).not.toContain(
          "rel",
        );
      }
    });

    test("new-tab item is described", async ({ page: browserPage }) => {
      await browserPage.goto(`${base}/${page}`);
      await browserPage.waitForSelector(containerSelector);

      const link = browserPage
        .locator(
          `${containerSelector} a[href="https://example.com/a"]:not([aria-hidden])`,
        )
        .first();
      await expect(link).toHaveAccessibleDescription(newWindowLabel);
      await expect(link).not.toHaveAccessibleName(/opens in a new tab/);
    });

    test("same-tab item is not described", async ({ page: browserPage }) => {
      await browserPage.goto(`${base}/${page}`);
      await browserPage.waitForSelector(containerSelector);

      const link = browserPage
        .locator(`${containerSelector} a[href$="local-post.html"]`)
        .first();
      await expect(link).not.toHaveAttribute("aria-describedby");
    });

    test("listing has no axe-core violations", async ({ page: browserPage }) => {
      await browserPage.goto(`${base}/${page}`);
      await browserPage.waitForSelector(containerSelector);
      await browserPage.waitForFunction(() => (window as any).axe);

      const violations = await browserPage.evaluate(async (selector) => {
        const axe = (window as any).axe;
        const container = document.querySelector(selector)!;
        const result = await axe.run(
          { include: [container] },
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
  });
});

test.describe("Link target in table rows", () => {
  test("table row click opens an isolated tab", async ({ page: browserPage, context }) => {
    await context.route("https://example.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>stub</title><p>stub</p>",
      }));
    await browserPage.goto(`${base}/table.html`);
    await browserPage.waitForSelector(".quarto-listing-table");

    const row = browserPage.locator(".quarto-listing-table tbody tr", {
      has: browserPage.locator('a[href="https://example.com/a"]'),
    });
    const popup = context.waitForEvent("page");
    await row.locator("td").last().click();
    const newPage = await popup;
    await newPage.waitForLoadState();
    expect(await newPage.evaluate(() => window.opener)).toBeNull();
  });
});

test.describe("Hostile target value", () => {
  test("hostile target stays one attribute", async ({ page: browserPage }) => {
    await browserPage.goto(`${base}/hostile.html`);
    await browserPage.waitForSelector(".quarto-listing-default");

    const link = browserPage
      .locator('.quarto-listing-default a[href="https://example.com/a"]')
      .first();
    expect(await link.getAttribute("target")).toBe('_blank" onmouseover="x');
    expect(await link.getAttribute("onmouseover")).toBeNull();
  });

  test("hostile path stays one attribute in table links", async ({ page: browserPage }) => {
    await browserPage.goto(`${base}/hostile-path.html`);
    await browserPage.waitForSelector(".quarto-listing-table");

    const link = browserPage.locator(".quarto-listing-table a.title").first();
    expect(await link.getAttribute("href")).toContain("onmouseover");
    expect(await link.getAttribute("onmouseover")).toBeNull();
  });
});

test.describe("Description after listing updates", () => {
  test("description survives paging", async ({ page: browserPage }) => {
    await browserPage.goto(`${base}/paged.html`);
    await browserPage
      .locator("#paged-listing-pagination .page.page-link", { hasText: "2" })
      .click();

    const link = browserPage.locator(
      '.quarto-listing-default .listing-title a[href="https://example.com/b"]',
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAccessibleDescription(newWindowLabel);
  });
});

test.describe("Option absent", () => {
  test("page without new-tab links has no label node", async ({ page: browserPage }) => {
    await browserPage.goto(`${base}/absent.html`);
    await browserPage.waitForSelector(".quarto-listing-default");

    await expect(browserPage.locator(`#${newWindowNoteId}`)).toHaveCount(0);
  });

  test("no target, rel or description on any anchor", async ({ page: browserPage }) => {
    await browserPage.goto(`${base}/absent.html`);
    await browserPage.waitForSelector(".quarto-listing-default");

    const anchors = browserPage.locator(".quarto-listing-default a");
    const count = await anchors.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const anchor = anchors.nth(i);
      await expect(anchor).not.toHaveAttribute("target");
      await expect(anchor).not.toHaveAttribute("rel");
      await expect(anchor).not.toHaveAttribute("aria-describedby");
    }
  });
});
