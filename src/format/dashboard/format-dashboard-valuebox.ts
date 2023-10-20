/*
 * format-dashboard-valuebox.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../core/deno-dom.ts";
import {
  applyClasses,
  processAndRemoveAttr,
} from "./format-dashboard-shared.ts";

const kValueboxClass = "valuebox";
const kValueboxBodySelector = ".card-body > div";
const kValueboxShowcaseClass = ".value-box-showcase";

const kValueBoxColorAttr = "data-color";
const kValueBoxBgColorAttr = "data-bg-color";
const kValueBoxFgColorAttr = "data-fg-color";
const kValueBoxIconAttr = "data-icon";
const kValueBoxShowcasePositionAttr = "data-showcase-position";

const kDefaultShowcasePosition = "left-center";

const bsLibValueBoxClz = ["bslib-value-box", "value-box-grid"];

// The list of colors that should be used when automatically assigning a color
// We'll just iterate through the list as we go (circular)
const kDefaultColors = ["secondary"];

export function isValueBox(el: Element) {
  return el.classList.contains(kValueboxClass);
}

export function processValueBoxes(doc: Document) {
  // Process value boxes
  const valueboxNodes = doc.body.querySelectorAll(`.${kValueboxClass}`);
  let autoColorizeCount = 0;
  for (const valueboxNode of valueboxNodes) {
    const valueboxEl = valueboxNode as Element;
    const valueboxBodyEl = valueboxEl.querySelector(kValueboxBodySelector);
    if (valueboxBodyEl) {
      applyClasses(valueboxBodyEl, bsLibValueBoxClz);

      // Resolve colors, first try the general color theme
      let colorProcessed = false;
      processAndRemoveAttr(
        valueboxBodyEl,
        kValueBoxColorAttr,
        (_el: Element, attrValue: string) => {
          colorEl(valueboxEl, attrValue, "background");
          colorProcessed = true;
        },
      );

      // Resolve colors, next try the background/foreground specific colors
      if (!colorProcessed) {
        processAndRemoveAttr(
          valueboxBodyEl,
          kValueBoxBgColorAttr,
          (_el: Element, attrValue: string) => {
            colorEl(valueboxEl, attrValue, "background");
            colorProcessed = true;
          },
        );

        processAndRemoveAttr(
          valueboxBodyEl,
          kValueBoxFgColorAttr,
          (_el: Element, attrValue: string) => {
            colorEl(valueboxEl, attrValue, "foreground");
            colorProcessed = true;
          },
        );
      }

      // Finally, try automatically assigning a color
      if (!colorProcessed) {
        const suggestedColorIndex = autoColorizeCount % kDefaultColors.length;
        colorEl(valueboxEl, kDefaultColors[suggestedColorIndex], "background");
        autoColorizeCount++;
      }
    }

    // Resolve the showcase
    const showcaseEl = valueboxEl.querySelector(kValueboxShowcaseClass);
    if (showcaseEl) {
      // Icon
      processAndRemoveAttr(
        showcaseEl,
        kValueBoxIconAttr,
        (el: Element, attrValue: string) => {
          const iconEl = doc.createElement("I");
          iconEl.classList.add("bi");
          iconEl.classList.add(`bi-${attrValue}`);
          el.append(iconEl);
        },
      );

      processAndRemoveAttr(
        showcaseEl,
        kValueBoxShowcasePositionAttr,
        (_el: Element, attrValue: string) => {
          valueboxEl.classList.add(`showcase-${attrValue}`);
        },
        kDefaultShowcasePosition,
      );
    }
  }
}

const isHtmlColor = (color: string) => {
  return color.startsWith("#");
};

const colorEl = (
  el: Element,
  color: string,
  type: "background" | "foreground",
) => {
  if (isHtmlColor(color)) {
    const styleName = type === "background" ? "background" : "color";
    const style = el.getAttribute("style");
    const currentStyle = style !== null ? style : "";
    el.setAttribute("style", currentStyle + ` ${styleName}: ${color};`);
  } else {
    const clsPrefix = type === "background" ? "bg-" : "text-";
    el.classList.add(`${clsPrefix}${color}`);
  }
};
