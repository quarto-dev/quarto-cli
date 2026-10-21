import { expect, Locator, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression test for #13444. The code copy button sits in the top-right
// corner of the code block, where the annotation gutter shows the marker of
// an annotated first line. The button must stay clear of the gutter so the
// marker can still be hovered (or clicked) to show its annotation.

const rightEdge = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!.x + box!.width;
};

const testCases = [
  { name: "hover", url: "html/code-annotation-copy-button.html" },
  { name: "select", url: "html/code-annotation-copy-button-select.html" },
  {
    name: "hover with a custom code block font size",
    url: "html/code-annotation-copy-button-font-size.html",
  },
];

test.describe("code copy button and code annotation marker", () => {
  for (const { name, url } of testCases) {
    test(`${name} — copy button does not cover the marker`, async ({ page }) => {
      await page.goto(getUrl(url), { waitUntil: "load" });

      const scaffold = page.locator(".code-copy-outer-scaffold").filter({
        has: page.locator("pre.code-annotated"),
      });
      const anchor = scaffold.locator("button.code-annotation-anchor");
      await expect(anchor).toHaveCount(1);
      const box = await anchor.boundingBox();
      expect(box).not.toBeNull();
      const x = box!.x + box!.width / 2;
      const y = box!.y + box!.height / 2;

      // Hovering the code block reveals the copy button, so check the marker
      // is still the top-most element at its own center while the button is
      // shown.
      await page.mouse.move(x, y);
      const hit = await page.evaluate(
        ([px, py]) =>
          document.elementFromPoint(px, py)?.closest(
            ".code-annotation-anchor, .code-copy-button",
          )?.className ?? null,
        [x, y],
      );
      expect(hit).toContain("code-annotation-anchor");

      // The button sits the default 5px left of the gutter, whatever the code
      // block font size the gutter width is derived from.
      const gutterLeft = (await scaffold.locator(".code-annotation-gutter")
        .boundingBox())!.x;
      const buttonRight = await rightEdge(
        scaffold.locator(".code-copy-button"),
      );
      expect(Math.abs(gutterLeft - buttonRight - 5)).toBeLessThanOrEqual(1);

      if (name === "select") {
        await page.mouse.click(x, y);
      }
      await expect(page.locator(".code-annotation-tip-content")).toBeVisible();
    });
  }

  test("copy button of a block without annotations is unchanged", async ({
    page,
  }) => {
    await page.goto(getUrl("html/code-annotation-copy-button.html"), {
      waitUntil: "load",
    });

    const scaffold = page.locator(".code-copy-outer-scaffold").filter({
      hasNot: page.locator("pre.code-annotated"),
    });
    await expect(scaffold).toHaveCount(1);
    const button = scaffold.locator(".code-copy-button");
    await expect(button).toHaveCSS("right", "0px");
    await expect(button).toHaveCSS("margin-right", "5px");
    expect((await rightEdge(scaffold)) - (await rightEdge(button)))
      .toBeCloseTo(5, 0);
  });
});
