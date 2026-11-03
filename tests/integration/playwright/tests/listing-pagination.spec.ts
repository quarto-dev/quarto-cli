import { expect, Page, test } from "@playwright/test";

const fixture = "./listings/pagination/_site/index.html";
const singleFixture = "./listings/pagination/_site/single.html";

// Link texts of each listing; the active page is wrapped in brackets.
const expected: Record<string, { page1: string; page6: string }> = {
  absent: { page1: "[1] 2 3 ...", page6: "... 4 5 [6] 7 8 ..." },
  invalid: { page1: "[1] 2 3 ...", page6: "... 4 5 [6] 7 8 ..." },
  left: { page1: "[1] 2 3 ...", page6: "1 2 ... 4 5 [6] 7 8 ..." },
  outer: { page1: "[1] 2 3 ... 10", page6: "1 ... 4 5 [6] 7 8 ... 10" },
  mixed: { page1: "[1] 2 ... 9 10", page6: "... 5 [6] 7 ... 9 10" },
};
const listingIds = Object.keys(expected);

const nav = (page: Page, id: string) => page.locator(`nav#${id}-pagination`);

async function linkTexts(page: Page, id: string): Promise<string> {
  await expect(nav(page, id).locator("li.active")).toBeVisible();
  const items = await nav(page, id).locator("li.page-item").all();
  const texts: string[] = [];
  for (const item of items) {
    const text = ((await item.locator(".page-link").textContent()) ?? "")
      .trim();
    const active = (await item.getAttribute("class"))?.split(/\s+/).includes(
      "active",
    );
    texts.push(active ? `[${text}]` : text);
  }
  return texts.join(" ");
}

// Every listing has built its page links once each nav has an active page.
async function gotoReady(page: Page) {
  await page.goto(fixture);
  for (const id of listingIds) {
    await expect(nav(page, id).locator("li.active")).toBeVisible();
  }
}

async function gotoPage6(page: Page) {
  await gotoReady(page);
  for (const id of listingIds) {
    await page.evaluate((id) => {
      window.location.hash = `#listing-${id}-page=6`;
    }, id);
    await expect(nav(page, id).locator("li.active")).toHaveText("6");
  }
}

function collectLogs(page: Page): string[] {
  const messages: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "log") messages.push(msg.text());
  });
  return messages;
}

async function axeViolations(page: Page, messages: string[]) {
  await page.locator("[data-quarto-axe-complete]").waitFor({ timeout: 15000 });
  for (const m of messages) {
    try {
      const parsed = JSON.parse(m);
      if (parsed.violations !== undefined) return parsed.violations;
    } catch {
      continue;
    }
  }
  return undefined;
}

test.describe("Listing pagination links", () => {
  for (const id of listingIds) {
    test(`${id}: link texts on page 1`, async ({ page }) => {
      await gotoReady(page);
      expect(await linkTexts(page, id)).toBe(expected[id].page1);
    });

    test(`${id}: link texts on page 6`, async ({ page }) => {
      await gotoReady(page);
      await page.evaluate((id) => {
        window.location.hash = `#listing-${id}-page=6`;
      }, id);
      await expect(nav(page, id).locator("li.active")).toHaveText("6");
      expect(await linkTexts(page, id)).toBe(expected[id].page6);
    });
  }
});

test.describe("Listing pagination accessibility", () => {
  for (const id of listingIds) {
    for (const state of ["page1", "page6"]) {
      test(`${id}: ARIA attributes on ${state}`, async ({ page }) => {
        await gotoReady(page);
        if (state === "page6") {
          await page.evaluate((id) => {
            window.location.hash = `#listing-${id}-page=6`;
          }, id);
          await expect(nav(page, id).locator("li.active")).toHaveText("6");
        }
        const n = nav(page, id);
        await expect(n).toHaveAttribute("aria-label", "Page navigation");

        const items = await n.locator("li.page-item").all();
        for (const item of items) {
          const link = item.locator(".page-link");
          const text = ((await link.textContent()) ?? "").trim();
          if (text === "...") {
            await expect(item).toHaveAttribute("aria-hidden", "true");
            await expect(link).not.toHaveAttribute("href", /.*/);
          } else {
            await expect(link).toHaveAttribute("aria-label", `Page ${text}`);
          }
        }

        const current = n.locator('[aria-current="page"]');
        await expect(current).toHaveCount(1);
        const activeText = state === "page1" ? "1" : "6";
        await expect(current).toHaveText(activeText);
        await expect(n.locator("li.active > a")).toHaveAttribute(
          "aria-current",
          "page",
        );
      });
    }
  }

  test("keyboard: Enter on a page link moves the current page", async ({ page }) => {
    await gotoReady(page);
    const link = nav(page, "outer").locator(".page-link", { hasText: /^2$/ });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#listing-outer-page=2$/);
    const current = nav(page, "outer").locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText("2");
  });

  test("keyboard: Tab skips gap items", async ({ page }) => {
    await gotoPage6(page);
    const focusable = nav(page, "outer").locator("a[href]");
    const texts = (await focusable.allTextContents()).map((t) => t.trim());
    expect(texts).not.toContain("...");
    expect(texts).toEqual(["1", "4", "5", "6", "7", "8", "10"]);
  });

  test("ARIA snapshot of the outer nav on page 1", async ({ page }) => {
    await gotoReady(page);
    await expect(nav(page, "outer")).toMatchAriaSnapshot(`
      - navigation "Page navigation":
        - list:
          - listitem:
            - link "Page 1":
              - /url: "#"
              - text: "1"
          - listitem:
            - link "Page 2":
              - /url: "#"
              - text: "2"
          - listitem:
            - link "Page 3":
              - /url: "#"
              - text: "3"
          - listitem:
            - link "Page 10":
              - /url: "#"
              - text: "10"
    `);
  });

  test("ARIA snapshot of the outer nav on page 6", async ({ page }) => {
    await gotoReady(page);
    await page.evaluate(() => {
      window.location.hash = "#listing-outer-page=6";
    });
    await expect(nav(page, "outer").locator("li.active")).toHaveText("6");
    await expect(nav(page, "outer")).toMatchAriaSnapshot(`
      - navigation "Page navigation":
        - list:
          - listitem:
            - link "Page 1":
              - /url: "#"
              - text: "1"
          - listitem:
            - link "Page 4":
              - /url: "#"
              - text: "4"
          - listitem:
            - link "Page 5":
              - /url: "#"
              - text: "5"
          - listitem:
            - link "Page 6":
              - /url: "#"
              - text: "6"
          - listitem:
            - link "Page 7":
              - /url: "#"
              - text: "7"
          - listitem:
            - link "Page 8":
              - /url: "#"
              - text: "8"
          - listitem:
            - link "Page 10":
              - /url: "#"
              - text: "10"
    `);
  });

  // With five listings on one page, every nav shares one label, so axe reports
  // landmark-unique. The single-listing page below checks that rule too.
  // region: the skip link sits outside any landmark, which has nothing to do
  // with pagination.
  const axeCases = [
    { name: "page 1", page: fixture, hash: "", ignored: ["landmark-unique", "region"] },
    { name: "page 6", page: fixture, hash: "#listing-outer-page=6", ignored: ["landmark-unique", "region"] },
    { name: "single listing page 1", page: singleFixture, hash: "", ignored: ["region"] },
    { name: "single listing page 6", page: singleFixture, hash: "#listing-only-page=6", ignored: ["region"] },
  ];

  for (const { name, page: url, hash, ignored } of axeCases) {
    test(`axe finds no violation on ${name}`, async ({ page }) => {
      const messages = collectLogs(page);
      await page.goto(`${url}${hash}`, { waitUntil: "networkidle" });
      const violations = await axeViolations(page, messages);
      expect(violations).toBeDefined();
      const ids = violations.map((v: { id: string }) => v.id).filter((
        id: string,
      ) => !ignored.includes(id));
      expect(ids).toEqual([]);
    });
  }

  test("no console error on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(fixture, { waitUntil: "networkidle" });
    expect(errors).toEqual([]);
  });
});
