/*
 * svg-alt.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { unitTest } from "../../test.ts";
import { getDomParser } from "../../../src/core/deno-dom.ts";
import { setSvgAlt } from "../../../src/core/svg.ts";

unitTest("SVG fig-alt preserves native accessibility when absent", async () => {
  const doc = (await getDomParser()).parseFromString(
    '<svg role="graphics-document" aria-labelledby="title" aria-describedby="desc"><title id="title">Native title</title><desc id="desc">Native description</desc></svg>',
    "text/html",
  )!;
  const svg = doc.querySelector("svg")!;
  const original = svg.outerHTML;
  setSvgAlt(svg, undefined);
  assertEquals(svg.outerHTML, original);
});

unitTest("SVG fig-alt replaces the name, not the native description", async () => {
  const doc = (await getDomParser()).parseFromString(
    '<svg aria-labelledby="title" aria-describedby="desc"><title id="title">Native title</title><desc id="desc">Native description</desc></svg>',
    "text/html",
  )!;
  const svg = doc.querySelector("svg")!;
  const alt = 'A "quoted" label & <tag> with café and 한글';
  setSvgAlt(svg, alt);
  assertEquals(svg.getAttribute("role"), "img");
  assertEquals(svg.getAttribute("aria-label"), alt);
  assertEquals(svg.getAttribute("aria-labelledby"), null);
  assertEquals(svg.getAttribute("aria-describedby"), "desc");
  assertEquals(svg.querySelector("desc")!.textContent, "Native description");
  const roundTrip = (await getDomParser()).parseFromString(svg.outerHTML, "text/html")!;
  assertEquals(roundTrip.querySelector("svg")!.getAttribute("aria-label"), alt);
  assertEquals(roundTrip.querySelector("tag"), null);
});

unitTest("empty SVG fig-alt makes the graphic decorative", async () => {
  const doc = (await getDomParser()).parseFromString(
    '<svg aria-label="Old label" aria-labelledby="title"><title id="title">Native title</title></svg>',
    "text/html",
  )!;
  const svg = doc.querySelector("svg")!;
  setSvgAlt(svg, "");
  assertEquals(svg.getAttribute("aria-hidden"), "true");
  assertEquals(svg.getAttribute("aria-label"), null);
  assertEquals(svg.getAttribute("aria-labelledby"), null);
});
