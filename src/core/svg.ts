/*
* svg.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { kFigHeight, kFigWidth } from "../config/constants.ts";
import { Element, getDomParser } from "./deno-dom.ts";
import { EitherString, MappedString } from "./lib/text-types.ts";
import { asMappedString, mappedDiff } from "./mapped-text.ts";
import { inInches } from "./units.ts";

export async function resolveSize(
  svg: string,
  options: Record<string, unknown>,
) {
  const dom = (await getDomParser()).parseFromString(svg, "text/html");
  const svgEl = dom?.querySelector("svg");
  if (!svgEl) {
    throw new Error("Internal Error: need an svg element");
  }
  const width = svgEl.getAttribute("width");
  const height = svgEl.getAttribute("height");
  if (!width || !height) {
    // attempt to resolve figure dimensions via viewBox
    throw new Error("Internal error: couldn't find figure dimensions");
  }
  const getViewBox = () => {
    const vb = svgEl.attributes.getNamedItem("viewBox").value; // do it the roundabout way so that viewBox isn't dropped by deno_dom and text/html
    if (!vb) return undefined;
    const lst = vb.trim().split(" ").map(Number);
    if (lst.length !== 4) return undefined;
    if (lst.some(isNaN)) return undefined;
    return lst;
  };

  let svgWidthInInches, svgHeightInInches;

  if (
    (width.slice(0, -2) === "pt" && height.slice(0, -2) === "pt") ||
    (width.slice(0, -2) === "px" && height.slice(0, -2) === "px") ||
    (!isNaN(Number(width)) && !isNaN(Number(height)))
  ) {
    // we assume 96 dpi which is generally what seems to be used.
    svgWidthInInches = Number(width.slice(0, -2)) / 96;
    svgHeightInInches = Number(height.slice(0, -2)) / 96;
  }
  const viewBox = getViewBox();
  if (viewBox !== undefined) {
    // assume width and height come from viewbox.
    const [_mx, _my, vbWidth, vbHeight] = viewBox;
    svgWidthInInches = vbWidth / 96;
    svgHeightInInches = vbHeight / 96;
  } else {
    throw new Error("Internal Error: Couldn't resolve width and height of SVG");
  }

  const svgWidthOverHeight = svgWidthInInches / svgHeightInInches;
  let widthInInches: number, heightInInches: number;

  if (options?.[kFigWidth] && options?.[kFigHeight]) {
    // both were prescribed, so just go with them
    widthInInches = inInches(String(options?.[kFigWidth]));
    heightInInches = inInches(String(options?.[kFigHeight]));
  } else if (options?.[kFigWidth]) {
    // we were only given width, use that and adjust height based on aspect ratio;
    widthInInches = inInches(String(options?.[kFigWidth]));
    heightInInches = widthInInches / svgWidthOverHeight;
  } else if (options?.[kFigHeight]) {
    // we were only given height, use that and adjust width based on aspect ratio;
    heightInInches = inInches(String(options?.[kFigHeight]));
    widthInInches = heightInInches * svgWidthOverHeight;
  } else {
    // we were not given either, use svg's prescribed height
    heightInInches = svgHeightInInches;
    widthInInches = svgWidthInInches;
  }

  return {
    widthInInches,
    heightInInches,
    widthInPoints: Math.round(widthInInches * 96),
    heightInPoints: Math.round(heightInInches * 96),
  };
}

export async function setSvgSize(
  svgSrc: EitherString,
  options: Record<string, unknown>,
  extra?: (node: Element) => void,
): Promise<MappedString> {
  const mappedSvgSrc = asMappedString(svgSrc);
  const {
    widthInPoints,
    heightInPoints,
  } = await resolveSize(mappedSvgSrc.value, options);

  const dom = (await getDomParser()).parseFromString(
    mappedSvgSrc.value,
    "text/html",
  );
  const svg = dom!.querySelector("svg")!;
  svg.setAttribute("width", widthInPoints);
  svg.setAttribute("height", heightInPoints);
  if (extra) {
    extra(svg);
  }
  return mappedDiff(mappedSvgSrc, svg.outerHTML);
}

export async function makeResponsive(
  svgSrc: EitherString,
  extras?: (node: Element) => void,
): Promise<MappedString> {
  const mappedSvgSrc = asMappedString(svgSrc);

  const dom = (await getDomParser()).parseFromString(
    mappedSvgSrc.value,
    "text/html",
  );
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

  let changed = false;

  if (numWidth > 650) {
    changed = true;
    svg.setAttribute("width", "100%");
    svg.removeAttribute("height");
  }

  if (extras) {
    changed = true;
    extras(svg);
  }

  if (changed) {
    return mappedDiff(mappedSvgSrc, svg.outerHTML);
  } else {
    return mappedSvgSrc;
  }
}
