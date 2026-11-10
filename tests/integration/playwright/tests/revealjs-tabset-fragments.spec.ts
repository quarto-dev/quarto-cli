import { expect, Page, test } from "@playwright/test";
import { resolve } from "node:path";
import { tabKey } from "../src/utils";

type StepState = { tabs: string[]; shown: string[] };

const axePath = resolve(__dirname, "../../../../src/resources/formats/html/axe/axe.min.js");

const open = async (page: Page, fixture: string, hash = "", query = "") => {
  await page.goto(`./revealjs/tabset-fragments-${fixture}.html${query}${hash}`);
  await expect(page.locator(".reveal.ready")).toBeAttached();
  await page.evaluate(() => (window as any).Reveal.configure({ transition: "none", backgroundTransition: "none" }));
};

// tabs: text of the aria-selected tab of each tabset on the slide, in DOM order.
// shown: data-probe (or a positional or text fallback) of the visible fragments of the slide, in step order.
const stepState = (page: Page, slideId: string): Promise<StepState> =>
  page.evaluate((id) => {
    const slide = document.getElementById(id)!;
    const tabs = Array.from(
      slide.querySelectorAll('ul.panel-tabset-tabby a[aria-selected="true"]'),
    ).map((a) => (a.textContent ?? "").trim());
    const visible = Array.from(
      slide.querySelectorAll(".fragment.visible:not(.panel-tabset-fragment-trigger)"),
    );
    const rank = (el: Element) => Number(el.getAttribute("data-fragment-index") ?? 0);
    const shown = visible
      .map((el, position) => ({ el, position }))
      .sort((a, b) => rank(a.el) - rank(b.el) || a.position - b.position)
      .map(({ el }) => {
        const probe = el.getAttribute("data-probe");
        if (probe) return probe;
        if (el.tagName === "CODE") {
          return `code[${Array.prototype.indexOf.call(el.parentElement!.children, el)}]`;
        }
        return (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 16);
      });
    return { tabs, shown };
  }, slideId);

const settled = async (page: Page, slideId: string) => {
  let previous = "";
  await expect
    .poll(async () => {
      const current = JSON.stringify(await stepState(page, slideId));
      const stable = current === previous;
      previous = current;
      return stable;
    }, { intervals: [50] })
    .toBe(true);
};

// Goes to the slide at fragment -1, records the state, then calls next() until the slide changes,
// then prev() back to fragment -1, recording each state while on the slide.
const walk = async (
  page: Page,
  slideId: string,
): Promise<{ forward: StepState[]; backward: StepState[] }> => {
  const indices = () => page.evaluate(() => JSON.stringify((window as any).Reveal.getIndices()));
  const advance = async (method: "next" | "prev") => {
    const before = await indices();
    await page.evaluate((m) => (window as any).Reveal[m](), method);
    await expect.poll(indices).not.toBe(before);
    await settled(page, slideId);
  };
  const here = () =>
    page.evaluate(
      (id) => {
        const R = (window as any).Reveal;
        const own = R.getIndices(document.getElementById(id));
        const cur = R.getIndices();
        return own.h === cur.h && (own.v ?? 0) === (cur.v ?? 0);
      },
      slideId,
    );
  await page.evaluate((id) => {
    const R = (window as any).Reveal;
    const i = R.getIndices(document.getElementById(id));
    R.slide(i.h, i.v, -1);
  }, slideId);
  await settled(page, slideId);
  const forward = [await stepState(page, slideId)];
  for (let n = 0; n < 40; n++) {
    await advance("next");
    if (!(await here())) break;
    forward.push(await stepState(page, slideId));
  }
  const backward: StepState[] = [];
  for (let n = 0; n < 40; n++) {
    await advance("prev");
    if (!(await here())) break;
    backward.push(await stepState(page, slideId));
    const f = await page.evaluate(
      () => (window as any).Reveal.getIndices().f ?? -1,
    );
    if (f === -1) break;
  }
  return { forward, backward };
};

test.describe("tabset-fragments registration", () => {
  test("option absent", async ({ page }) => {
    await open(page, "absent");
    expect(
      await page.evaluate(() => (window as any).Reveal.hasPlugin("QuartoTabsetFragments")),
    ).toBe(false);
    await expect(page.locator(".panel-tabset-fragment-trigger")).toHaveCount(0);
    const { forward } = await walk(page, "absent");
    expect(forward.map((s) => s.tabs)).toEqual([["Tab A"], ["Tab A"], ["Tab A"]]);
    expect(forward.map((s) => s.shown)).toEqual([[], ["absent-a"], ["absent-a", "absent-b"]]);
  });

  test("option on registers the plugin", async ({ page }) => {
    await open(page, "nav");
    const state = await page.evaluate(() => ({
      has: (window as any).Reveal.hasPlugin("QuartoTabsetFragments"),
      config: (window as any).Reveal.getConfig().tabsetFragments,
    }));
    expect(state).toEqual({ has: true, config: true });
  });

  test("class registers the plugin with the deck option off", async ({ page }) => {
    await open(page, "class");
    const state = await page.evaluate(() => ({
      has: (window as any).Reveal.hasPlugin("QuartoTabsetFragments"),
      config: (window as any).Reveal.getConfig().tabsetFragments,
    }));
    expect(state).toEqual({ has: true, config: false });
  });
});

type Step = [string | string[], ...string[]];

// Builds the expected walk: the first tab(s) with nothing shown, then one state per step,
// where each step names the selected tab(s) and the fragments that appear at that step.
const expectedWalk = (first: string | string[], ...steps: Step[]): StepState[] => {
  const asTabs = (t: string | string[]) => (Array.isArray(t) ? t : [t]);
  const states: StepState[] = [{ tabs: asTabs(first), shown: [] }];
  let shown: string[] = [];
  for (const [tabs, ...added] of steps) {
    shown = [...shown, ...added];
    states.push({ tabs: asTabs(tabs), shown });
  }
  return states;
};

const expectWalk = async (
  page: Page,
  fixture: string,
  id: string,
  expected: StepState[],
  prepare?: () => Promise<void>,
) => {
  await open(page, fixture);
  await prepare?.();
  const { forward, backward } = await walk(page, id);
  expect(forward).toEqual(expected);
  expect(backward).toEqual([...expected].reverse());
};

const orders: Array<[string, string, string, StepState[]]> = [
  ["C1 stepped highlight in tab 1 pane", "code", "c1", expectedWalk("Tab A",
    ["Tab A", "code[1]"], ["Tab A", "code[2]"], ["Tab B"], ["Tab B", "c1-b"])],
  ["C2 stepped highlights in both tabs", "code", "c2", expectedWalk("Tab A",
    ["Tab A", "code[1]"], ["Tab A", "code[2]"], ["Tab B"], ["Tab B", "code[1]"], ["Tab B", "code[2]"])],
  ["C3 fragment indices in a pane keep their order", "code", "c3", expectedWalk("Tab A",
    ["Tab A", "c3-note1"], ["Tab A", "code[1]"], ["Tab A", "c3-note2"], ["Tab A", "code[2]"],
    ["Tab B"], ["Tab B", "c3-b"])],
  ["C4 highlight before and after the tabset", "code", "c4", expectedWalk("Tab A",
    ["Tab A", "code[1]"], ["Tab A", "code[2]"], ["Tab A", "c4-a"], ["Tab B"], ["Tab B", "c4-b"],
    ["Tab B", "code[1]"], ["Tab B", "code[2]"])],
  ["C5 static highlight adds no fragment", "code", "c5", expectedWalk("Tab A",
    ["Tab B"], ["Tab B", "c5-b"])],
  ["C6 code cell highlight", "code", "c6", expectedWalk("Tab A",
    ["Tab A", "code[1]"], ["Tab A", "code[2]"], ["Tab B"], ["Tab B", "c6-b"])],

  ["I1 deck incremental", "incremental-deck", "i1", expectedWalk("Tab A",
    ["Tab A", "a1"], ["Tab A", "a2"], ["Tab B"], ["Tab B", "b1"], ["Tab B", "b2"],
    ["Tab B", "z1"], ["Tab B", "z2"])],
  ["I2 incremental list in tab 2 only", "incremental", "i2", expectedWalk("Tab A",
    ["Tab B"], ["Tab B", "b1"], ["Tab B", "b2"])],
  ["I3 nonincremental list in tab 1", "incremental-deck", "i3", expectedWalk("Tab A",
    ["Tab B"], ["Tab B", "b1"], ["Tab B", "b2"])],
  ["I4 nested incremental list", "incremental", "i4", expectedWalk("Tab A",
    ["Tab A", "p1 q1 q2"], ["Tab A", "q1"], ["Tab A", "q2"], ["Tab A", "p2"], ["Tab B"], ["Tab B", "i4-b"])],
  ["I5 pause in a pane", "incremental", "i5", expectedWalk("Tab A",
    ["Tab A", "After pause"], ["Tab B"], ["Tab B", "i5-b"])],
  ["I6 pause before the tabset", "incremental", "i6", expectedWalk("Tab A",
    ["Tab A", "Tab ATab B A tex"], ["Tab A", "i6-a"], ["Tab B"], ["Tab B", "i6-b"])],

  ["M1 fragment in a pane", "manual", "m1", expectedWalk("Tab A",
    ["Tab A", "m1-a"], ["Tab B"], ["Tab B", "m1-b"])],
  ["M2 fragment indices in a pane", "manual", "m2", expectedWalk("Tab A",
    ["Tab A", "m2-a1"], ["Tab A", "m2-a2"], ["Tab A", "m2-a3"], ["Tab B"], ["Tab B", "m2-b"])],
  ["M3 equal indices in two tabs", "manual", "m3", expectedWalk("Tab A",
    ["Tab A", "m3-a"], ["Tab B"], ["Tab B", "m3-b"])],
  ["M4 index 0 after the tabset", "manual", "m4", expectedWalk("Tab A",
    ["Tab A", "m4-zero"], ["Tab A", "m4-a"], ["Tab B"], ["Tab B", "m4-b"])],
  ["M5 effects", "manual", "m5", expectedWalk("Tab A",
    ["Tab A", "m5-fadeout"], ["Tab A", "m5-semifadeout"], ["Tab A", "m5-currentvisible"],
    ["Tab A", "m5-highlightred"], ["Tab A", "m5-grow"], ["Tab B"], ["Tab B", "m5-b"])],
  ["M6 nested fragments", "manual", "m6", expectedWalk("Tab A",
    ["Tab A", "m6-outer"], ["Tab A", "m6-inner"], ["Tab B"], ["Tab B", "m6-b"])],
  ["M7 fragment wraps the tabset", "manual", "m7", expectedWalk("Tab A",
    ["Tab A", "m7-wrap"], ["Tab A", "m7-a"], ["Tab B"], ["Tab B", "m7-b"])],
  ["M8 fragment on a tab heading is not kept by the filter", "manual", "m8", expectedWalk("Tab A",
    ["Tab A", "m8-a"], ["Tab B"], ["Tab B", "m8-b"])],
  ["M9 output-location fragments", "manual", "m9", expectedWalk("Tab A",
    ["Tab A", "[1] 2"], ["Tab B"], ["Tab B", "[1] 4"])],
  ["M10 r-stack of fragments", "manual", "m10", expectedWalk("Tab A",
    ["Tab A", "m10-s1"], ["Tab A", "m10-s2"], ["Tab B"], ["Tab B", "m10-b"])],
  ["M12 fragment class on the tabset appears at its own step", "manual", "m12", expectedWalk("Tab A",
    ["Tab A", "m12-before"], ["Tab A", "m12-set"], ["Tab A", "m12-a"], ["Tab B"], ["Tab B", "m12-b"],
    ["Tab B", "m12-after"])],

  ["L1 two tabsets with a fragment between", "layout", "l1", expectedWalk(["Tab 1a", "Tab 1b"],
    [["Tab 1a", "Tab 1b"], "l1-1a"], [["Tab 2a", "Tab 1b"]], [["Tab 2a", "Tab 1b"], "l1-2a"],
    [["Tab 2a", "Tab 1b"], "l1-between"], [["Tab 2a", "Tab 1b"], "l1-1b"],
    [["Tab 2a", "Tab 2b"]], [["Tab 2a", "Tab 2b"], "l1-2b"])],
  ["L2 nested tabsets", "layout", "l2", expectedWalk(["Outer 1", "Inner 1"],
    [["Outer 1", "Inner 1"], "l2-o1"], [["Outer 1", "Inner 1"], "l2-i1"],
    [["Outer 1", "Inner 2"]], [["Outer 1", "Inner 2"], "l2-i2"],
    [["Outer 2", "Inner 2"]], [["Outer 2", "Inner 2"], "l2-o2"])],
  ["L3 inner class in a tabset that is not fragmented", "layout", "l3", expectedWalk(["Outer 1", "Inner 1"],
    [["Outer 1", "Inner 1"], "l3-i1"], [["Outer 1", "Inner 1"], "l3-i2"], [["Outer 1", "Inner 1"], "l3-o2"])],
  ["L4 columns and callout", "layout", "l4", expectedWalk(["Tab A", "Tab A"],
    [["Tab A", "Tab A"], "l4-col-a"], [["Tab B", "Tab A"]], [["Tab B", "Tab A"], "l4-col-b"],
    [["Tab B", "Tab A"], "l4-call-a"], [["Tab B", "Tab B"]], [["Tab B", "Tab B"], "l4-call-b"])],
  ["L5 tab with an empty pane", "layout", "l5", expectedWalk("Tab A",
    ["Tab A", "l5-a"], ["Tab B"], ["Tab C"], ["Tab C", "l5-c"])],
  ["L6 single tab gets no trigger", "layout", "l6", expectedWalk("Only tab",
    ["Only tab", "l6-only"])],
  ["L7 auto-animate", "layout", "l7", expectedWalk("Tab A",
    ["Tab A", "l7-a"], ["Tab B"], ["Tab B", "l7-b"])],
  ["L7b auto-animate partner", "layout", "l7b", expectedWalk("Tab A",
    ["Tab A", "l7b-a"], ["Tab B"], ["Tab B", "l7b-b"])],
  ["L8 vertical slide", "layout", "l8", expectedWalk("Tab A",
    ["Tab A", "l8-a"], ["Tab B"], ["Tab B", "l8-b"])],
  ["L8 slide after the hidden slide", "layout", "l8after", expectedWalk("Tab A",
    ["Tab A", "l8after-a"], ["Tab B"], ["Tab B", "l8after-b"])],
];

test.describe("tabset-fragments step order", () => {
  for (const [title, fixture, id, expected] of orders) {
    test(title, async ({ page }) => {
      await expectWalk(page, fixture, id, expected);
    });
  }

  test("L3 warns once for each ignored inner class, naming the tabset", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "warning" && msg.text().includes("tabset-fragments")) warnings.push(msg.text());
    });
    await open(page, "layout");
    expect(warnings).toHaveLength(3);
    for (const name of ["Inner 1", "Alpha 1", "Beta 1"]) {
      expect(warnings.filter((w) => w.includes(`"${name}"`))).toHaveLength(1);
    }
  });

  test("L6 single tab has no trigger", async ({ page }) => {
    await open(page, "layout");
    await expect(page.locator("#l6 .panel-tabset-fragment-trigger")).toHaveCount(0);
  });

  test("L8 hidden slide is removed", async ({ page }) => {
    await open(page, "layout");
    await expect(page.locator("#l8hidden")).toHaveCount(0);
  });

  test("M11 autoslide on a fragment keeps the step order", async ({ page }) => {
    await expectWalk(
      page,
      "manual",
      "m11",
      expectedWalk("Tab A", ["Tab A", "m11-a"], ["Tab B"], ["Tab B", "m11-b"]),
      () =>
        page.evaluate(() => {
          const R = (window as any).Reveal;
          R.configure({ autoSlide: 0 });
          R.toggleAutoSlide(false);
        }),
    );
  });
});

type PdfPage = { tabs: string[]; visibleTabs: string[]; panes: string[]; number: string | null };

const pdfPages = async (page: Page, fixture: string, query: string, heading: string): Promise<PdfPage[]> => {
  await page.goto(`./revealjs/tabset-fragments-${fixture}.html?print-pdf${query}`);
  let last = 0;
  await expect
    .poll(async () => {
      const count = await page.evaluate(() => document.querySelectorAll(".pdf-page").length);
      const stable = count > 0 && count === last;
      last = count;
      return stable;
    }, { intervals: [100], timeout: 15000 })
    .toBe(true);
  return readPdfPages(page, heading);
};

const readPdfPages = (page: Page, heading: string): Promise<PdfPage[]> =>
  page.evaluate((id) =>
    Array.from(document.querySelectorAll(".pdf-page"))
      .filter((p) => (p.querySelector("h2")?.textContent ?? "").trim() === id)
      .map((p) => ({
        tabs: Array.from(p.querySelectorAll('ul.panel-tabset-tabby a[aria-selected="true"]')).map(
          (a) => (a.textContent ?? "").trim(),
        ),
        visibleTabs: Array.from(p.querySelectorAll('ul.panel-tabset-tabby a[aria-selected="true"]'))
          .filter((a) => a.getClientRects().length > 0)
          .map((a) => (a.textContent ?? "").trim()),
        panes: Array.from(p.querySelectorAll(".tab-content > div"))
          .filter((d) => getComputedStyle(d).display !== "none")
          .map((d) => (d.textContent ?? "").trim().split("\n")[0]),
        number: p.querySelector(".slide-number-pdf")?.textContent ?? null,
      })), heading);

test.describe("tabset-fragments print", () => {
  test("N4 separate pages: one page per step, each on the tab of its step", async ({ page }) => {
    const pages = await pdfPages(page, "print", "", "Print tabset");
    expect(pages.map((p) => p.tabs[0])).toEqual(["Tab A", "Tab A", "Tab B", "Tab B", "Tab C", "Tab C"]);
    expect(pages.map((p) => p.panes)).toEqual([["A text"], ["A text"], ["B text"], ["B text"], ["C text"], ["C text"]]);
  });

  test("N4 separate pages: opt-out slide keeps the first tab", async ({ page }) => {
    const pages = await pdfPages(page, "print", "", "Print opt-out");
    expect(pages.every((p) => p.tabs[0] === "Tab A")).toBe(true);
  });

  test("N4 clone pages: one page per tab, numbered N.k, no duplicate id", async ({ page }) => {
    const pages = await pdfPages(page, "print-clone", "", "Print tabset");
    expect(pages.map((p) => p.tabs[0])).toEqual(["Tab A", "Tab B", "Tab C"]);
    expect(pages.map((p) => p.panes)).toEqual([["A text"], ["B text"], ["C text"]]);
    expect(pages.map((p) => p.number)).toEqual(["2.1", "2.2", "2.3"]);
    const duplicates = await page.evaluate(() => {
      const seen = new Set<string>();
      const dup: string[] = [];
      document.querySelectorAll("[id]").forEach((e) => {
        if (e.closest("svg")) return;
        if (seen.has(e.id)) dup.push(e.id);
        seen.add(e.id);
      });
      return dup;
    });
    expect(duplicates).toEqual([]);
  });

  test("N4 clone pages: nested tabsets step inner first, then outer", async ({ page }) => {
    const pages = await pdfPages(page, "print-clone", "", "Print nested");
    expect(pages.map((p) => p.visibleTabs)).toEqual([
      ["Outer 1", "Inner 1"],
      ["Outer 1", "Inner 2"],
      ["Outer 2", "Inner 3"],
      ["Outer 2", "Inner 4"],
    ]);
    expect(pages.map((p) => p.number)).toEqual(["4.1", "4.2", "4.3", "4.4"]);
  });

  test("N4 clone pages: sibling tabsets step one after the other", async ({ page }) => {
    const pages = await pdfPages(page, "print-clone", "", "Print siblings");
    expect(pages.map((p) => p.visibleTabs)).toEqual([
      ["Left 1", "Right 1"],
      ["Left 2", "Right 1"],
      ["Left 2", "Right 2"],
    ]);
    expect(pages.map((p) => p.number)).toEqual(["5.1", "5.2", "5.3"]);
  });

  test("N4 clone pages: every tab link points to a pane in its own copy", async ({ page }) => {
    await pdfPages(page, "print-clone", "", "Print nested");
    const result = await page.evaluate(() => {
      const seen = new Set<string>();
      const duplicates: string[] = [];
      document.querySelectorAll("[id]").forEach((e) => {
        if (e.closest("svg")) return;
        if (seen.has(e.id)) duplicates.push(e.id);
        seen.add(e.id);
      });
      const links = Array.from(document.querySelectorAll(".pdf-page ul.panel-tabset-tabby a"));
      const dangling = links
        .filter((a) => {
          const target = new URL((a as HTMLAnchorElement).href).hash.slice(1);
          const pdfPage = a.closest(".pdf-page")!;
          return !Array.from(pdfPage.querySelectorAll("[id]")).some((e) => e.id === target);
        })
        .map((a) => (a as HTMLAnchorElement).getAttribute("href"));
      return { duplicates, dangling, links: links.length };
    });
    expect(result.links).toBeGreaterThan(0);
    expect(result.duplicates).toEqual([]);
    expect(result.dangling).toEqual([]);
  });

  test("N4 clone pages: copies keep the scroll position of the source", async ({ page }) => {
    await pdfPages(page, "print-clone", "", "Print scroll");
    const scrolled = await page.evaluate(() => {
      const R = (window as any).Reveal;
      const pages = Array.from(document.querySelectorAll(".pdf-page")).filter(
        (p) => (p.querySelector("h2")?.textContent ?? "").trim() === "Print scroll",
      );
      pages.slice(1).forEach((p) => p.remove());
      pages[0].querySelector("#scroller")!.scrollTop = 25;
      R.dispatchEvent({ type: "pdf-ready" });
      return Array.from(document.querySelectorAll(".pdf-page"))
        .filter((p) => (p.querySelector("h2")?.textContent ?? "").trim() === "Print scroll")
        .map((p) => p.querySelector('[id^="scroller"]')!.scrollTop);
    });
    expect(scrolled).toEqual([25, 25]);
  });

  test("N4 clone pages: ids inside svg are left as they are", async ({ page }) => {
    await pdfPages(page, "print-clone", "", "Print svg");
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".pdf-page"))
        .filter((p) => (p.querySelector("h2")?.textContent ?? "").trim() === "Print svg")
        .map((p) => ({
          ids: Array.from(p.querySelectorAll("svg [id]")).map((e) => e.id),
          fill: p.querySelector("svg rect")!.getAttribute("fill"),
        }))
    );
    expect(ids).toHaveLength(2);
    for (const copy of ids) {
      expect(copy).toEqual({ ids: ["bar-gradient", "bar-rect"], fill: "url(#bar-gradient)" });
    }
  });

  test("N4 clone pages: the deck events do not change the tabs of the copies", async ({ page }) => {
    const before = await pdfPages(page, "print-clone", "", "Print tabset");
    await page.evaluate(() => {
      const R = (window as any).Reveal;
      R.dispatchEvent({ type: "slidechanged" });
      R.dispatchEvent({ type: "fragmentshown" });
    });
    const after = await readPdfPages(page, "Print tabset");
    expect(after.map((p) => p.visibleTabs)).toEqual(before.map((p) => p.visibleTabs));
    expect(after.map((p) => p.visibleTabs[0])).toEqual(["Tab A", "Tab B", "Tab C"]);
  });

  test("N4 clone pages: opt-out slide stays one page on the first tab", async ({ page }) => {
    const pages = await pdfPages(page, "print-clone", "", "Print opt-out");
    expect(pages.length).toBe(1);
    expect(pages[0].tabs[0]).toBe("Tab A");
    expect(pages[0].number).toBe("3");
  });

  test("N5 page cap: separate pages are not capped, tab per step is kept", async ({ page }) => {
    const pages = await pdfPages(page, "print", "&pdfMaxPagesPerSlide=1", "Print tabset");
    expect(pages.map((p) => p.tabs[0])).toEqual(["Tab A", "Tab A", "Tab B", "Tab B", "Tab C", "Tab C"]);
  });

  test("N5 page cap: clone pages are not capped", async ({ page }) => {
    const pages = await pdfPages(page, "print-clone", "&pdfMaxPagesPerSlide=1", "Print tabset");
    expect(pages.map((p) => p.tabs[0])).toEqual(["Tab A", "Tab B", "Tab C"]);
    expect(pages.map((p) => p.number)).toEqual(["2.1", "2.2", "2.3"]);
  });
});

test.describe("tabset-fragments navigation", () => {
  test("N1 backward entry shows the last tab with its fragments", async ({ page }) => {
    await open(page, "nav");
    const { forward } = await walk(page, "n1");
    expect(forward.map((s) => s.tabs[0])).toEqual(["Tab A", "Tab A", "Tab B", "Tab B"]);
    await page.evaluate(() => {
      const R = (window as any).Reveal;
      const i = R.getIndices(document.getElementById("n8"));
      R.slide(i.h, i.v, -1);
    });
    await page.evaluate(() => (window as any).Reveal.prev());
    await expect.poll(() => stepState(page, "n1")).toEqual(forward[forward.length - 1]);
  });

  test("N2 deep link to each fragment index matches the forward walk", async ({ page }) => {
    await open(page, "nav");
    const { forward } = await walk(page, "n1");
    expect(forward.map((s) => s.tabs[0])).toEqual(["Tab A", "Tab A", "Tab B", "Tab B"]);
    for (let f = 0; f < forward.length - 1; f++) {
      await open(page, "nav", `#/n1/${f}`, "?fragmentInURL=true");
      await expect.poll(() => page.evaluate(() => (window as any).Reveal.getIndices().f)).toBe(f);
      await expect.poll(() => stepState(page, "n1")).toEqual(forward[f + 1]);
    }
  });

  test("N3 fragments disabled: no triggers, first tab stays", async ({ page }) => {
    await open(page, "nofragments", "", "?fragments=false");
    await expect(page.locator(".panel-tabset-fragment-trigger")).toHaveCount(0);
    const { forward } = await walk(page, "n3");
    expect(forward.every((s) => s.tabs[0] === "Tab A")).toBe(true);
  });

  test("N6 speaker view preview shows the same tab at each step", async ({ page }) => {
    await open(page, "nav", "#/n6");
    const popup = page.waitForEvent("popup");
    await page.keyboard.press("s");
    const speaker = await popup;
    const preview = speaker.frameLocator("#current-slide iframe");
    const tab = preview.locator('#n6 ul.panel-tabset-tabby a[aria-selected="true"]');
    await expect(tab).toHaveText("Tab A");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('#n6 ul.panel-tabset-tabby a[aria-selected="true"]')).toHaveText("Tab B");
    await expect(tab).toHaveText("Tab B");
  });

  test("N9 scroll view follows the fragment steps in both directions", async ({ page }) => {
    await open(page, "nav", "", "?view=scroll");
    await expect.poll(() => page.evaluate(() => (window as any).Reveal.isScrollView())).toBe(true);
    const goTo = (k: number) =>
      page.evaluate((step) => {
        const viewport = (window as any).Reveal.getViewportElement();
        const scrollPage = document.getElementById("n1")!.closest(".scroll-page") as HTMLElement;
        const triggerHeight = parseFloat((scrollPage.querySelector(".scroll-snap-point") as HTMLElement).style.height);
        viewport.scrollTop = scrollPage.offsetTop + (step + 1) * triggerHeight;
      }, k);
    const tab = () => page.locator('#n1 ul.panel-tabset-tabby a[aria-selected="true"]');
    const steps: Array<[number, string]> = [[-1, "Tab A"], [0, "Tab A"], [1, "Tab B"], [2, "Tab B"]];
    for (const [k, expected] of [...steps, ...[...steps].reverse()]) {
      await goTo(k);
      await expect(tab()).toHaveText(expected);
    }
  });

  test("N12 a sync that switches a tab on another slide keeps the scroll position", async ({ page }) => {
    await open(page, "nav", "", "?view=scroll");
    await expect.poll(() => page.evaluate(() => (window as any).Reveal.isScrollView())).toBe(true);
    const result = await page.evaluate(async () => {
      const viewport = (window as any).Reveal.getViewportElement();
      const own = (document.getElementById("n1")!.closest(".scroll-page") as HTMLElement).offsetTop;
      const other = document.getElementById("n8")!;
      (other.querySelectorAll("ul.panel-tabset-tabby a")[2] as HTMLElement).click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      viewport.scrollTop = own;
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        own,
        top: viewport.scrollTop,
        tab: other.querySelector('ul.panel-tabset-tabby a[aria-selected="true"]')!.textContent!.trim(),
      };
    });
    expect(result.tab).toBe("Tab A");
    expect(result.top).toBe(result.own);
  });

  test("N10 stepping works again after a trip through scroll view", async ({ page }) => {
    await open(page, "nav");
    await page.evaluate(() => {
      const R = (window as any).Reveal;
      R.configure({ view: "scroll" });
      R.toggleScrollView(true);
    });
    await expect.poll(() => page.evaluate(() => (window as any).Reveal.isScrollView())).toBe(true);
    await page.evaluate(() => {
      const R = (window as any).Reveal;
      R.configure({ view: null });
      R.toggleScrollView(false);
    });
    await expect.poll(() => page.evaluate(() => (window as any).Reveal.isScrollView())).toBe(false);
    const { forward } = await walk(page, "n1");
    expect(forward.map((s) => s.tabs[0])).toEqual(["Tab A", "Tab A", "Tab B", "Tab B"]);
  });

  test("N11 deep link over file:// shows the tab of the step", async ({ page }) => {
    const fixture = resolve(__dirname, "../../../docs/playwright/revealjs/tabset-fragments-nav.html");
    await page.goto(`file://${fixture}?fragmentInURL=true#/n1/2`);
    await expect(page.locator(".reveal.ready")).toBeAttached();
    await expect.poll(() => page.evaluate(() => (window as any).Reveal.getIndices().f)).toBe(2);
    await expect(page.locator('#n1 ul.panel-tabset-tabby a[aria-selected="true"]')).toHaveText("Tab B");
  });

  test("N8 next after a click on another tab follows the step, not the click", async ({ page }) => {
    await open(page, "nav");
    await page.evaluate(() => {
      const R = (window as any).Reveal;
      const i = R.getIndices(document.getElementById("n8"));
      R.slide(i.h, i.v, -1);
    });
    await page.evaluate(() => (window as any).Reveal.next());
    await expect.poll(() => stepState(page, "n8")).toEqual({ tabs: ["Tab A"], shown: ["n8-a"] });
    await page.locator("#n8 ul.panel-tabset-tabby > li > a").nth(2).click();
    expect((await stepState(page, "n8")).tabs).toEqual(["Tab C"]);
    await page.evaluate(() => (window as any).Reveal.next());
    await expect.poll(() => stepState(page, "n8")).toEqual({ tabs: ["Tab B"], shown: ["n8-a"] });
    await page.evaluate(() => (window as any).Reveal.next());
    await expect.poll(() => stepState(page, "n8")).toEqual({ tabs: ["Tab B"], shown: ["n8-a", "n8-b"] });
  });
});

const toStep = async (page: Page, slideId: string, f: number) => {
  await page.evaluate(
    ([id, fragment]) => {
      const R = (window as any).Reveal;
      const i = R.getIndices(document.getElementById(id as string));
      R.slide(i.h, i.v, fragment);
    },
    [slideId, f] as [string, number],
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).Reveal.getIndices().f ?? -1))
    .toBe(f);
  await settled(page, slideId);
};

const focusedLabel = (page: Page) =>
  page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");

test.describe("tabset-fragments accessibility", () => {
  const snapshots = [
    [-1, `- tablist:
  - tab "Tab A" [selected]
  - tab "Tab B"
- tabpanel "Tab A"`],
    [0, `- tablist:
  - tab "Tab A" [selected]
  - tab "Tab B"
- tabpanel "Tab A":
  - paragraph: A text`],
    [1, `- tablist:
  - tab "Tab A"
  - tab "Tab B" [selected]
- tabpanel "Tab B"`],
    [2, `- tablist:
  - tab "Tab A"
  - tab "Tab B" [selected]
- tabpanel "Tab B":
  - paragraph: B text`],
  ] as const;

  for (const [f, snapshot] of snapshots) {
    test(`A1 aria snapshot of the tabset at fragment ${f}`, async ({ page }) => {
      await open(page, "nav");
      await toStep(page, "n1", f);
      await expect(page.locator("#n1 .panel-tabset")).toMatchAriaSnapshot(snapshot);
    });
  }

  test("A2 triggers are hidden from the accessibility tree", async ({ page }) => {
    await open(page, "nav");
    const triggers = page.locator("#n1 .panel-tabset-fragment-trigger");
    await expect(triggers).toHaveCount(1);
    await expect(triggers).toHaveAttribute("aria-hidden", "true");
    await expect(triggers).toBeHidden();
  });

  test("A7 the live deck keeps tabby's own markers on the tabset", async ({ page }) => {
    await open(page, "nav");
    for (const f of [-1, 0, 1, 2]) {
      await toStep(page, "n1", f);
      const markers = await page.evaluate(() => {
        const tabset = document.querySelector("#n1 .panel-tabset")!;
        return {
          activeClasses: tabset.querySelectorAll("li.active, .tab-content > div.active").length,
          paneStyles: Array.from(tabset.querySelectorAll(".tab-content > div")).map((d) => d.getAttribute("style")),
          tabindexes: Array.from(tabset.querySelectorAll("ul.panel-tabset-tabby a")).map((a) => a.getAttribute("tabindex")),
        };
      });
      expect(markers).toEqual({ activeClasses: 0, paneStyles: [null, null], tabindexes: ["0", "0"] });
    }
  });

  test("A8 stepping across a tab does not move the focus", async ({ page }) => {
    await open(page, "nav", "#/n1");
    await toStep(page, "n1", 0);
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    const before = await page.evaluate(() => document.activeElement?.tagName);
    await page.evaluate(() => (window as any).Reveal.next());
    await expect(page.locator('#n1 ul.panel-tabset-tabby a[aria-selected="true"]')).toHaveText("Tab B");
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(before);
  });

  test("A8 stepping keeps the focus on a tab link of the same tabset", async ({ page }) => {
    await open(page, "nav", "#/n1");
    await toStep(page, "n1", 0);
    await page.locator("#n1 [role=tab]").first().focus();
    await page.evaluate(() => (window as any).Reveal.next());
    await expect(page.locator('#n1 ul.panel-tabset-tabby a[aria-selected="true"]')).toHaveText("Tab B");
    expect(await focusedLabel(page)).toBe("Tab B");
  });

  test("A3 Tab order is tab, panel content, next tab at the first step", async ({ page, browserName }) => {
    await open(page, "nav", "#/a11y");
    await toStep(page, "a11y", -1);
    await page.locator("#a11y [role=tab]").first().focus();
    const order = [await focusedLabel(page)];
    for (let n = 0; n < 3; n++) {
      await page.keyboard.press(tabKey(browserName));
      order.push(await focusedLabel(page));
    }
    expect(order).toEqual(["Tab A", "Button in A", "Tab B", "Button in B"]);
  });

  test("A4 Tab order follows the selected tab at the last step", async ({ page, browserName }) => {
    await open(page, "nav", "#/a11y");
    await toStep(page, "a11y", 2);
    await page.getByRole("tab", { name: "Tab B" }).focus();
    await page.keyboard.press(tabKey(browserName));
    await expect(page.getByRole("button", { name: "Button in B" })).toBeFocused();
    await page.keyboard.press(tabKey(browserName, true));
    await expect(page.getByRole("tab", { name: "Tab B" })).toBeFocused();
  });

  for (const [label, f, key, expected] of [
    ["first step, End", -1, "End", "Tab B"],
    ["last step, Home", 2, "Home", "Tab A"],
  ] as const) {
    test(`A5 ${label} switches tabs without changing the slide`, async ({ page }) => {
      await open(page, "nav", "#/a11y");
      await toStep(page, "a11y", f);
      const before = await page.evaluate(() => (window as any).Reveal.getIndices());
      await page.locator("#a11y [role=tab][aria-selected=true]").focus();
      await page.keyboard.press(key);
      await expect(page.getByRole("tab", { name: expected })).toHaveAttribute("aria-selected", "true");
      expect(await page.evaluate(() => (window as any).Reveal.getIndices())).toEqual(before);
    });
  }

  test("A6 the slide has no axe-core violations at the first and last step", async ({ page }) => {
    await open(page, "nav", "#/a11y");
    await page.addScriptTag({ path: axePath });
    for (const f of [-1, 2]) {
      await toStep(page, "a11y", f);
      const violations = await page.evaluate(async () => {
        const result = await (window as any).axe.run(
          { include: [document.querySelector("#a11y")!] },
          { rules: { "color-contrast": { enabled: false }, "heading-order": { enabled: false } } },
        );
        return result.violations.map((v: { id: string; nodes: { target: string[] }[] }) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        }));
      });
      expect(violations).toEqual([]);
    }
  });
});
