/*
 * format-dashboard-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { Format, Metadata } from "../../config/types.ts";
import { Element } from "../../core/deno-dom.ts";

export const kDashboard = "dashboard";

export interface DashboardMeta {
  orientation: "rows" | "columns";
  fill: boolean;
}

export function dashboardMeta(format: Format): DashboardMeta {
  const dashboardRaw = format.metadata as Metadata;
  const orientation = dashboardRaw && dashboardRaw.orientation === "columns"
    ? "columns"
    : "rows";
  const fill = dashboardRaw && dashboardRaw.fill === true;

  return {
    orientation,
    fill,
  };
}

// Processes an attribute, then remove it
export const processAndRemoveAttr = (
  el: Element,
  attr: string,
  process: (el: Element, attrValue: string) => void,
) => {
  // See whether this card is expandable
  const resolvedAttr = el.getAttribute(attr);
  if (resolvedAttr !== null) {
    process(el, resolvedAttr);
    el.removeAttribute(attr);
  }
};

// Converts the value of an attribute to a style on the
// element itself
export const attrToStyle = (style: string) => {
  return (el: Element, attrValue: string) => {
    const newStyle: string[] = [];

    const currentStyle = el.getAttribute("style");
    if (currentStyle !== null) {
      newStyle.push(currentStyle);
    }
    newStyle.push(`${style}: ${attrValue};`);
    el.setAttribute("style", newStyle.join(" "));
  };
};

// Converts an attribute on a card to a style applied to
// the card body(ies)
export const attrToCardBodyStyle = (style: string) => {
  return (el: Element, attrValue: string) => {
    const cardBodyNodes = el.querySelectorAll(".card-body");
    for (const cardBodyNode of cardBodyNodes) {
      const cardBodyEl = cardBodyNode as Element;
      const newStyle: string[] = [];

      const currentStyle = el.getAttribute("style");
      if (currentStyle !== null) {
        newStyle.push(currentStyle);
      }
      newStyle.push(`${style}: ${attrValue};`);
      cardBodyEl.setAttribute("style", newStyle.join(" "));
    }
  };
};
