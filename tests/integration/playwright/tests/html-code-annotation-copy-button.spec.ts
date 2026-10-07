import { expect, test } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression test for #13444. The code copy button sits in the top-right
// corner of the code block, where the annotation gutter shows the marker of
// an annotated first line. The button must stay clear of the gutter so the
// marker can still be hovered to show its annotation.
test("code copy button does not cover the code annotation marker", async ({
  page,
}) => {
  await page.goto(getUrl("html/code-annotation-copy-button.html"), {
    waitUntil: "load",
  });

  const anchor = page.locator("button.code-annotation-anchor");
  await expect(anchor).toHaveCount(1);
  const box = await anchor.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  // Hovering the code block reveals the copy button, so check the marker is
  // still the top-most element at its own center while the button is shown.
  await page.mouse.move(x, y);
  const hit = await page.evaluate(
    ([px, py]) =>
      document.elementFromPoint(px, py)?.closest(
        ".code-annotation-anchor, .code-copy-button",
      )?.className ?? null,
    [x, y],
  );
  expect(hit).toContain("code-annotation-anchor");

  await expect(page.locator(".code-annotation-tip-content")).toBeVisible();
});
