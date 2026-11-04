import { expect, Page, test } from "@playwright/test";

const clones = (slide: string) =>
  `section#${slide} pre > code:not(:first-child)`;
const base = (slide: string) => `section#${slide} pre > code:first-child`;

// Reveal.js renumbers fragment indices to their rank on the slide, so these are ranks, not the authored values.
const cloneIndices = (page: Page, slide: string) =>
  page.locator(clones(slide)).evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-fragment-index"))
  );

const luminance = ([r, g, b]: number[]) => {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const parseRgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);

test.describe("code-line-fragment-indices sets the fragment index of each highlight step (#7378)", () => {
  let problems: string[];
  let warnings: string[];

  test.beforeEach(async ({ page }) => {
    problems = [];
    warnings = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(msg.text());
      if (msg.type() === "warning") warnings.push(msg.text());
    });
    page.on("pageerror", (err) => problems.push(err.message));
  });

  const open = async (page: Page, slide: string) => {
    await page.goto(`./revealjs/code-line-fragment-indices.html#/${slide}`);
    await expect(page.locator(".reveal.ready")).toBeAttached();
  };

  test("attribute absent keeps sequential steps", async ({ page }) => {
    await open(page, "absent");
    await expect(page.locator(clones("absent"))).toHaveCount(2);
    for (const clone of await page.locator(clones("absent")).all()) {
      await expect(clone).toHaveClass(/fragment/);
    }
    expect(await cloneIndices(page, "absent")).toEqual(["0", "1"]);
    await expect(page.locator(clones("absent")).first()).toHaveClass(
      /has-line-highlights/,
    );
    expect(problems).toEqual([]);
    expect(
      warnings.filter((w) => !w.includes('"1,2,4"') && !w.includes('"1,abc"')),
    ).toEqual([]);
  });

  test("valid list sets each clone index", async ({ page }) => {
    await open(page, "valid");
    const baseCode = page.locator(base("valid"));
    await expect(baseCode).not.toHaveClass(/fragment/);
    await expect(baseCode).not.toHaveAttribute("data-fragment-index", /.*/);
    expect(await cloneIndices(page, "valid")).toEqual(["1", "3"]);
    await expect(page.locator("section#valid div.sourceCode")).not
      .toHaveAttribute(
        "data-code-line-fragment-indices",
        /.*/,
      );

    const notes = page.locator("section#valid div.fragment");
    const [clone1, clone2] = await page.locator(clones("valid")).all();
    const reveal = async () => {
      await page.evaluate(() => (window as any).Reveal.next());
    };

    await reveal();
    await expect(notes.nth(0)).toHaveClass(/visible/);
    await expect(clone1).not.toHaveClass(/visible/);
    await reveal();
    await expect(clone1).toHaveClass(/visible/);
    await expect(notes.nth(1)).not.toHaveClass(/visible/);
    await reveal();
    await expect(notes.nth(1)).toHaveClass(/visible/);
    await expect(clone2).not.toHaveClass(/visible/);
    await reveal();
    await expect(clone2).toHaveClass(/visible/);
    expect(problems).toEqual([]);
  });

  for (
    const [name, slide, attr] of [
      ["count mismatch", "mismatch", "1,2,4"],
      ["invalid entry", "invalid", "1,abc"],
    ]
  ) {
    test(`${name} falls back to sequential`, async ({ page }) => {
      await open(page, slide);
      expect(await cloneIndices(page, slide)).toEqual(["0", "1"]);
      const related = warnings.filter((w) => w.includes(`"${attr}"`));
      expect(related).toHaveLength(1);
      expect(related[0]).toContain(`"${attr}"`);
      expect(problems).toEqual([]);
    });
  }

  test("valid list replaces an existing fragment index", async ({ page }) => {
    await open(page, "raw");
    expect(await cloneIndices(page, "raw")).toEqual(["0", "2"]);
    await expect(page.locator(base("raw"))).not.toHaveAttribute(
      "data-fragment-index",
      /.*/,
    );
  });

  test("highlighted lines meet contrast", async ({ page }) => {
    await open(page, "valid");
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => (window as any).Reveal.next());
    }
    const clone = page.locator(clones("valid")).first();
    await expect(clone).toHaveClass(/visible/);
    await expect.poll(() =>
      clone.evaluate((el) => getComputedStyle(el).opacity)
    ).toBe("1");

    const ratios = await clone.evaluate((code) => {
      const bg =
        getComputedStyle(document.querySelector(".reveal-viewport") as Element)
          .backgroundColor;
      const toRatio = (span: Element) => {
        const style = getComputedStyle(span);
        let opacity = 1;
        for (
          let el: Element | null = span;
          el && el !== document.body;
          el = el.parentElement
        ) {
          opacity *= parseFloat(getComputedStyle(el).opacity);
        }
        return { color: style.color, opacity };
      };
      const lit = code.querySelector("span.highlight-line");
      return {
        bg,
        lit: lit ? toRatio(lit) : null,
      };
    });

    const bg = parseRgb(ratios.bg);
    const effective = (item: { color: string; opacity: number }) => {
      const fg = parseRgb(item.color);
      const mixed = fg.slice(0, 3).map((c, i) =>
        c * item.opacity + bg[i] * (1 - item.opacity)
      );
      return contrast(mixed, bg);
    };

    expect(ratios.lit).not.toBeNull();
    expect(effective(ratios.lit!)).toBeGreaterThanOrEqual(4.5);
  });
});
