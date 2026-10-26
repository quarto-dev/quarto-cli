import { expect, Locator, Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getUrl } from "../src/utils";

// Regression test for #13448. Selecting a code annotation draws a band over
// its lines, and a second band in the annotation gutter. Both bands must stay
// inside the code block, cover the line-number column, and line up with each
// other and with the annotated lines.

type Box = { x: number; y: number; width: number; height: number };

const tolerance = 1.5;

const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
};

const annotatedLines = async (page: Page, dt: Locator): Promise<Box> => {
  const cell = await dt.getAttribute("data-target-cell");
  const annotation = await dt.getAttribute("data-target-annotation");
  return page.evaluate(([cell, annotation]) => {
    const span = document.querySelector(
      `span[data-code-cell="${cell}"][data-code-annotation="${annotation}"]`,
    )!;
    const lines = span.getAttribute("data-code-lines")!.split(",");
    const first = document.getElementById(`${cell}-${lines[0]}`)!
      .getBoundingClientRect();
    const last = document.getElementById(`${cell}-${lines[lines.length - 1]}`)!
      .getBoundingClientRect();
    return {
      x: first.x,
      y: first.y,
      width: first.width,
      height: last.bottom - first.top,
    };
  }, [cell, annotation]);
};

const expectBandsPlaced = async (page: Page, block: Locator) => {
  const terms = block.locator("xpath=following-sibling::*[1]")
    .locator("dt[data-target-cell]");
  const count = await terms.count();
  expect(count).toBeGreaterThan(1);
  const sourceCode = await boxOf(block.locator("div.sourceCode"));
  for (let i = 0; i < count; i++) {
    const dt = terms.nth(i);
    await dt.click();
    const band = await boxOf(page.locator("#code-annotation-line-highlight"));
    const gutterBand = await boxOf(
      page.locator("#code-annotation-line-highlight-gutter"),
    );
    const lines = await annotatedLines(page, dt);

    // The band spans the code block, line-number column included, and does
    // not overflow it.
    expect(Math.abs(band.x - sourceCode.x)).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(band.x + band.width - (sourceCode.x + sourceCode.width)),
    ).toBeLessThanOrEqual(tolerance);

    // The band covers the annotated lines and little more.
    expect(band.y).toBeLessThanOrEqual(lines.y);
    expect(band.y + band.height).toBeGreaterThanOrEqual(
      lines.y + lines.height,
    );
    expect(lines.y - band.y).toBeLessThanOrEqual(2 + tolerance);
    expect(band.y + band.height - (lines.y + lines.height))
      .toBeLessThanOrEqual(2 + tolerance);

    // The gutter band lines up with the band.
    expect(Math.abs(gutterBand.y - band.y)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(gutterBand.height - band.height)).toBeLessThanOrEqual(
      tolerance,
    );

    await dt.click();
    await expect(page.locator("#code-annotation-line-highlight"))
      .toHaveCount(0);
  }
};

const htmlCases = [
  { name: "html", url: "html/code-annotation-highlight.html" },
  { name: "dashboard", url: "dashboard/code-annotation-highlight.html" },
];

test.describe("code annotation line highlight", () => {
  for (const { name, url } of htmlCases) {
    for (const [label, index] of [["without", 0], ["with", 1]] as const) {
      test(`${name} — ${label} line numbers, bands fit the code block`, async ({ page }) => {
        await page.goto(getUrl(url), { waitUntil: "load" });
        const block = page.locator(".code-copy-outer-scaffold")
          .filter({ has: page.locator("pre.code-annotated") })
          .nth(index);
        await block.scrollIntoViewIfNeeded();
        await expectBandsPlaced(page, block);
      });
    }
  }

  for (const [slide, index] of [
    ["without-line-numbers", 1],
    ["with-line-numbers", 2],
  ] as const) {
    test(`revealjs — ${slide}, bands fit the code block`, async ({ page }) => {
      await page.goto(getUrl("revealjs/code-annotation-highlight.html"), {
        waitUntil: "load",
      });
      await page.waitForFunction(() => (window as any).Reveal?.isReady());
      await page.evaluate((h) => (window as any).Reveal.slide(h), index);
      const section = page.locator(`section#${slide}`);
      await expect(section).toHaveClass(/present/);
      const block = section.locator(".code-copy-outer-scaffold");
      await expect(block).toBeVisible();
      await expectBandsPlaced(page, block);
    });
  }

  for (const scheme of ["light", "dark"] as const) {
    test(`html — ${scheme} theme, highlighted code keeps its contrast`, async ({ page }) => {
      // Known gap, older than #13448: the light band tint lowers the
      // contrast of the arrow theme's `.im` tokens to 4.24:1. The tokens
      // leave no room for a tint, as #14959 shows for Reveal.js.
      test.fail(scheme === "light");
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(getUrl("html/code-annotation-highlight-contrast.html"), {
        waitUntil: "load",
      });
      await expect(page.locator("body")).toHaveClass(
        scheme === "dark" ? /quarto-dark/ : /quarto-light/,
      );
      await page.locator("dt[data-target-cell]").first().click();
      await expect(page.locator("#code-annotation-line-highlight"))
        .toBeVisible();
      await page.addScriptTag({
        content: readFileSync(
          join(
            __dirname,
            "../../../../src/resources/formats/html/axe/axe.min.js",
          ),
          "utf8",
        ),
      });
      const violations = await page.evaluate(async () => {
        const axe = (window as any).axe;
        const result = await axe.run("div.sourceCode", {
          runOnly: { type: "rule", values: ["color-contrast"] },
        });
        return result.violations.flatMap((v: { nodes: { target: string[] }[] }) =>
          v.nodes.map((n) => n.target.join(" "))
        );
      });
      expect(violations).toEqual([]);
    });
  }
});
