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

// Code callouts, with the paragraph-only callout of the same appearance
// they are compared with at the edge where the code sits.
const cases = [
  { id: "titled-first", edge: "top", reference: "titled-paragraph" },
  { id: "titled-last", edge: "bottom", reference: "titled-paragraph" },
  { id: "titled-cell-first", edge: "top", reference: "titled-paragraph" },
  { id: "titled-cell-last", edge: "bottom", reference: "titled-paragraph" },
  { id: "titled-annotated", edge: "top", reference: "titled-paragraph" },
  { id: "collapse-first", edge: null, reference: null },
  { id: "simple-first", edge: "top", reference: "simple-paragraph" },
  { id: "minimal-last", edge: "bottom", reference: "minimal-paragraph" },
] as const;

test.describe("Code copy button in callouts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl("html/callout-code-copy-button.html"), {
      waitUntil: "load",
    });
  });

  for (const { id, edge, reference } of cases) {
    test(`${id}: copy button sits inside the code frame`, async ({ page }) => {
      const plain = await geometry(page, "plain");
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
});
