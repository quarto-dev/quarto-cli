/*
 * svg.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { kFigHeight, kFigWidth } from "../config/constants.ts";
import { Attr, Element, getDomParser } from "./deno-dom.ts";
import { EitherString, MappedString } from "./lib/text-types.ts";
import { asMappedString, mappedDiff } from "./mapped-text.ts";
import { inInches } from "./units.ts";

// NB: there's effectively a copy of this function
// in our mermaid runtime in `formats/html/mermaid/mermaid-runtime.js`.
// if you change something here, you must keep it consistent there as well.
export async function resolveSize(
  svg: string,
  options: Record<string, unknown>,
) {
  const dom = (await getDomParser()).parseFromString(svg, "text/html");
  const svgEl = dom?.querySelector("svg");
  if (!svgEl) {
    throw new Error("Internal Error: need an svg element");
  }
  let width = svgEl.getAttribute("width");
  let height = svgEl.getAttribute("height");
  const getViewBox = () => {
    // work around https://github.com/b-fuze/deno-dom/issues/133
    const m = svg.match(/viewbox/i);
    if (!m) return undefined;
    const vb = denoDomWorkaroundNamedItemAccessor(svg, svgEl, "viewbox")?.value; // do it the roundabout way so that viewBox isn't dropped by deno_dom and text/html
    if (!vb) return undefined;
    const lst = vb.trim().split(" ").map(Number);
    if (lst.length !== 4) return undefined;
    if (lst.some(isNaN)) return undefined;
    return lst;
  };

  if (!width || !height) {
    // attempt to resolve figure dimensions via viewBox
    const viewBox = getViewBox();
    if (viewBox !== undefined) {
      const [_mx, _my, vbWidth, vbHeight] = viewBox;
      width = `${vbWidth}px`;
      height = `${vbHeight}px`;
    } else {
      throw new Error("Internal error: couldn't find figure dimensions");
    }
  }

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
    explicitWidth: options?.[kFigWidth] !== undefined,
    explicitHeight: options?.[kFigHeight] !== undefined,
  };
}

// NB: there's effectively a copy of this function
// in our mermaid runtime in `formats/html/mermaid/mermaid-runtime.js`.
// if you change something here, you must keep it consistent there as well.
export const fixupAlignment = (svg: Element, align: string) => {
  let style = svg.getAttribute("style") ?? "";

  switch (align) {
    case "left":
      style = `${style}; display: block; margin: auto auto auto 0`;
      break;
    case "right":
      style = `${style}; display: block; margin: auto 0 auto auto`;
      break;
    case "center":
      style = `${style}; display: block; margin: auto auto auto auto`;
      break;
  }
  svg.setAttribute("style", style);
};

// https://github.com/b-fuze/deno-dom/issues/133
const denoDomWorkaroundNamedItemAccessor = (
  _str: string,
  el: Element,
  key: string,
): Attr | null => {
  key = key.toLocaleLowerCase();

  for (let i = 0; i < el.attributes.length; ++i) {
    const attr = el.attributes.item(i);
    if (attr?.name.toLowerCase() === key) {
      return attr;
    }
  }
  return null;
};

// NB: there's effectively a copy of this function
// in our mermaid runtime in `formats/html/mermaid/mermaid-runtime.js`.
// if you change something here, you must keep it consistent there as well.
export async function setSvgSize(
  svgSrc: EitherString,
  options: Record<string, unknown>,
  extra?: (node: Element) => void,
): Promise<MappedString> {
  const mappedSvgSrc = asMappedString(svgSrc);
  const {
    widthInPoints,
    heightInPoints,
    explicitHeight,
    explicitWidth,
  } = await resolveSize(mappedSvgSrc.value, options);

  const dom = (await getDomParser()).parseFromString(
    mappedSvgSrc.value,
    "text/html",
  );
  const svg = dom!.querySelector("svg")!;
  if (explicitWidth && explicitHeight) {
    svg.setAttribute("width", widthInPoints);
    svg.setAttribute("height", heightInPoints);
    // if explicit width and height are given, we need to remove max-width and max-height
    // so that the figure doesn't get squished.
    svg.setAttribute(
      "style",
      (denoDomWorkaroundNamedItemAccessor(mappedSvgSrc.value, svg, "style")
        ?.value || "") +
        "; max-width: none; max-height: none",
    );
  } else {
    // we don't have access to svg.style as a property here...
    // so we have to do it the roundabout way.
    let style =
      denoDomWorkaroundNamedItemAccessor(mappedSvgSrc.value, svg, "style")
        ?.value || "";
    if (explicitWidth) {
      style = `${style}; max-width: ${widthInPoints}px`;
    }
    if (explicitHeight) {
      style = `${style}; max-height: ${heightInPoints}px`;
    }
    if (explicitWidth || explicitHeight) {
      svg.setAttribute("style", style);
    }
  }
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
