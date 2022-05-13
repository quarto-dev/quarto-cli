/*
* svg.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { getDomParser } from "./deno-dom.ts";

export async function makeResponsive(svgSrc: string): Promise<string> {
  const dom = (await getDomParser()).parseFromString(svgSrc, "text/html");
  if (dom === null) {
    throw new Error("Couldn't parse element");
  }
  const svg = dom.querySelector("svg");
  if (svg === null) {
    throw new Error("Couldn't find SVG element");
  }
  const width = svg.getAttribute("width");
  if (width === null) {
    throw new Error("Couldn't find SVG width");
  }
  const numWidth = Number(width.slice(0, -2));
  if (numWidth > 650) {
    svg.setAttribute("width", "100%");
    svg.removeAttribute("height");
    return svg.outerHTML;
  } else {
    return svgSrc;
  }
}
