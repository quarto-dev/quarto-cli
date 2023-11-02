/*
 * format-dashboard-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { Format, Metadata } from "../../config/types.ts";
import { Document, Element } from "../../core/deno-dom.ts";

export const kDashboard = "dashboard";

// Carries the layout for a given row or column
export const kLayoutAttr = "data-layout";
export const kLayoutFill = "fill";
export const kLayoutFlow = "flow";
export type Layout = "fill" | "flow" | string;

export const kDashboardGridSkip = "grid-skip";

export const kNavButtons = "nav-buttons";

export const kDontMutateTags = ["P", "SCRIPT"];

export interface NavButton {
  href: string;
  text?: string;
  icon?: string;
}

export interface DashboardMeta {
  orientation: "rows" | "columns";
  scrolling: boolean;
  expandable: boolean;
  [kNavButtons]: NavButton[];
}

export const kValueboxClass = "valuebox";

export function dashboardMeta(format: Format): DashboardMeta {
  const dashboardRaw = format.metadata as Metadata;
  const orientation = dashboardRaw && dashboardRaw.orientation === "columns"
    ? "columns"
    : "rows";
  const scrolling = dashboardRaw.scrolling === true;
  const expandable = dashboardRaw.expandable !== false;

  const processNavbarButton = (buttonRaw: unknown) => {
    if (typeof (buttonRaw) === "string") {
      // TODO: parse string aliases into nice urls
      return undefined;
    } else {
      return buttonRaw as NavButton;
    }
  };

  const navbarButtons = [];
  const navbarButtonsRaw = format.metadata[kNavButtons];
  if (Array.isArray(navbarButtonsRaw)) {
    navbarButtonsRaw.forEach((btnRaw) => {
      const btn = processNavbarButton(btnRaw);
      if (btn) {
        navbarButtons.push(btn);
      }
    });
  } else {
    const btn = processNavbarButton(navbarButtonsRaw);
    if (btn) {
      navbarButtons.push(btn);
    }
  }

  return {
    orientation,
    scrolling,
    expandable,
    [kNavButtons]: navbarButtons,
  };
}

export interface Attr {
  id?: string;
  classes?: string[];
  attributes?: Record<string, string>;
}

export function hasFlowLayout(el: Element) {
  return el.getAttribute(kLayoutAttr) === kLayoutFlow;
}

// Generic helper function for making elements
export function makeEl(
  name: string,
  attr: Attr,
  doc: Document,
) {
  const el = doc.createElement(name);
  if (attr.id) {
    el.id = attr.id;
  }

  for (const cls of attr.classes || []) {
    el.classList.add(cls);
  }

  const attribs = attr.attributes || {};
  for (const key of Object.keys(attribs)) {
    el.setAttribute(key, attribs[key]);
  }

  return el;
}

// Processes an attribute, then remove it
export const processAndRemoveAttr = (
  el: Element,
  attr: string,
  process: (el: Element, attrValue: string) => void,
  defaultValue?: string,
) => {
  // See whether this card is expandable
  const resolvedAttr = el.getAttribute(attr);
  if (resolvedAttr !== null) {
    process(el, resolvedAttr);
    el.removeAttribute(attr);
  } else if (defaultValue) {
    process(el, defaultValue);
  }
};

// Wraps other processing functions and makes sure that
// the value has css units before passing it along
export const ensureCssUnits = (
  fn: (el: Element, attrValue: string) => void,
) => {
  return (el: Element, attrValue: string) => {
    if (attrValue === "0") {
      // Zero is allowed without units
      fn(el, attrValue);
    } else {
      // This ends with a number and it isn't zero, make it px
      const attrWithUnits = attrValue.match(kEndsWithNumber)
        ? `${attrValue}px`
        : attrValue;
      fn(el, attrWithUnits);
    }
  };
};
const kEndsWithNumber = /[0-9]$/;

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

export const applyClasses = (el: Element, clz: string[]) => {
  for (const cls of clz) {
    el.classList.add(cls);
  }
};

export const applyAttributes = (el: Element, attr: Record<string, string>) => {
  for (const key of Object.keys(attr)) {
    el.setAttribute(key, attr[key]);
  }
};
