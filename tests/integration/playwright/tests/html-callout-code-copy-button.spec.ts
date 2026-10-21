import { expect, test, type Page } from "@playwright/test";
import { getUrl } from "../src/utils";

// Regression tests for #13446 and #13238. Code blocks are wrapped in
// div.code-copy-outer-scaffold, which holds div.sourceCode and the copy
// button. The callout first/last-child rules must treat that wrapper like a
// code block: the button stays inside the code frame, and code at the edge of
// a callout gets the same gap as a paragraph there.

interface Geometry {
  // Copy button top minus div.sourceCode top
  buttonOffset: number | null;
  buttonHeight: number | null;
  // Visible top of the first block below the header (or callout top)
  topGap: number;
  // Callout bottom minus visible bottom of the last block
  bottomGap: number;
}

async function geometry(page: Page, id: string): Promise<Geometry> {
  return await page.evaluate((id) => {
    const el = document.getElementById(id)!;
    // Code frame is the div.sourceCode border box; text is a paragraph's
    // content box.
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      if (e.tagName !== "P") return { top: r.top, bottom: r.bottom };
      const cs = getComputedStyle(e);
      return {
        top: r.top + parseFloat(cs.paddingTop),
        bottom: r.bottom - parseFloat(cs.paddingBottom),
      };
    };
    const header = el.querySelector(".callout-header");
    const ref = header && getComputedStyle(header).display !== "none"
      ? header.getBoundingClientRect().bottom
      : el.getBoundingClientRect().top;
    const blocks = Array.from(
      el.querySelectorAll("div.sourceCode, .callout-body-container > p"),
    );
    const div = el.querySelector("div.sourceCode");
    const button = el.querySelector(".code-copy-button");
    return {
      buttonOffset: div && button
        ? button.getBoundingClientRect().top - div.getBoundingClientRect().top
        : null,
      buttonHeight: button ? button.getBoundingClientRect().height : null,
      topGap: visible(blocks[0]).top - ref,
      bottomGap: el.getBoundingClientRect().bottom -
        visible(blocks[blocks.length - 1]).bottom,
    };
  }, id);
}

// Code callouts, with the block outside a callout their copy button is
// compared with, and the paragraph-only callout of the same appearance they
// are compared with at the edge where the code sits.
const cases = [
  { id: "titled-first", button: "plain", edge: "top", reference: "titled-paragraph" },
  { id: "titled-last", button: "plain", edge: "bottom", reference: "titled-paragraph" },
  { id: "titled-cell-first", button: "plain", edge: "top", reference: "titled-paragraph" },
  { id: "titled-cell-last", button: "plain", edge: "bottom", reference: "titled-paragraph" },
  { id: "titled-annotated", button: "plain-annotated", edge: "top", reference: "titled-paragraph" },
  { id: "collapse-first", button: "plain", edge: null, reference: null },
  { id: "simple-first", button: "plain", edge: "top", reference: "simple-paragraph" },
  { id: "minimal-last", button: "plain", edge: "bottom", reference: "minimal-paragraph" },
] as const;

test.describe("Code copy button in callouts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl("html/callout-code-copy-button.html"), {
      waitUntil: "load",
    });
  });

  for (const { id, button, edge, reference } of cases) {
    test(`${id}: copy button sits inside the code frame`, async ({ page }) => {
      const plain = await geometry(page, button);
      const code = await geometry(page, id);
      expect(code.buttonOffset).not.toBeNull();
      expect(Math.abs(code.buttonOffset! - plain.buttonOffset!))
        .toBeLessThanOrEqual(1);
      expect(Math.abs(code.buttonHeight! - plain.buttonHeight!))
        .toBeLessThanOrEqual(1);
    });

    if (edge && reference) {
      test(`${id}: code at the ${edge} edge is spaced like a paragraph`, async ({ page }) => {
        const code = await geometry(page, id);
        const para = await geometry(page, reference);
        const gap = edge === "top" ? "topGap" : "bottomGap";
        expect(Math.abs(code[gap] - para[gap])).toBeLessThanOrEqual(1);
      });
    }
  }

  // Inside the code frame, the button of an annotated first line must still
  // leave the annotation marker hoverable, as it does outside a callout.
  test("titled-annotated: copy button does not cover the marker", async ({ page }) => {
    const anchor = page.locator(
      "div#titled-annotated button.code-annotation-anchor",
    );
    await expect(anchor).toHaveCount(1);
    // elementFromPoint only sees the viewport.
    await anchor.scrollIntoViewIfNeeded();
    const box = (await anchor.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Hovering the marker also reveals the copy button.
    await page.mouse.move(x, y);
    const hit = await page.evaluate(
      ([px, py]) =>
        document.elementFromPoint(px, py)?.closest(
          ".code-annotation-anchor, .code-copy-button",
        )?.className ?? null,
      [x, y],
    );
    expect(hit).toContain("code-annotation-anchor");
  });
});
