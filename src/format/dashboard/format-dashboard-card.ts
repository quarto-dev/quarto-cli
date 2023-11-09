/*
 * format-dashboard-card.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element, Node } from "../../core/deno-dom.ts";
import { recursiveApplyFillClasses } from "./format-dashboard-layout.ts";
import {
  applyAttributes,
  applyClasses,
  attrToCardBodyStyle,
  attrToStyle,
  DashboardMeta,
  ensureCssUnits,
  hasFlowLayout,
  kValueboxClass,
  makeEl,
  processAndRemoveAttr,
} from "./format-dashboard-shared.ts";

// The html to generate the expand button
const kExpandBtnHtml = `
<bslib-tooltip placement="auto" bsoptions="[]" data-require-bs-version="5" data-require-bs-caller="tooltip()">
    <template>Expand</template>
    <span class="bslib-full-screen-enter badge rounded-pill">
        <svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 24 24" style="height:1em;width:1em;" aria-hidden="true" role="img"><path d="M20 5C20 4.4 19.6 4 19 4H13C12.4 4 12 3.6 12 3C12 2.4 12.4 2 13 2H21C21.6 2 22 2.4 22 3V11C22 11.6 21.6 12 21 12C20.4 12 20 11.6 20 11V5ZM4 19C4 19.6 4.4 20 5 20H11C11.6 20 12 20.4 12 21C12 21.6 11.6 22 11 22H3C2.4 22 2 21.6 2 21V13C2 12.4 2.4 12 3 12C3.6 12 4 12.4 4 13V19Z"></path></svg>
    </span>
</bslib-tooltip>
`;

// Card classes
const kCardClass = "card";
const kCardBodyClass = "card-body";
const kCardHeaderClass = "card-header";
const kCardFooterClass = "card-footer";
const kCardTitleClass = "card-title";
const kCardToolbarClass = "card-toolbar";
const kCardTitleToolbarClass = "card-title-toolbar";

// Tabset classes
const kTabsetClass = "tabset";

// Tabset BS values
const kTabsetIdPrefix = "card-tabset-";

// Card attributes (our options are expressed using these attributes)
const kAttrTitle = "data-title";
const kAttrExpandable = "data-expandable";
const kAttrMaxHeight = "data-max-height";
const kAttrMinHeight = "data-min-height";
const kAttrHeight = "data-height";
const kAttrPadding = "data-padding";

// BSLib Attributes
const kAttrFullScreen = "data-full-screen";

// BSLib Card Classes
const kBsCardClasses = ["bslib-card", "html-fill-container"];
const kBsCardScriptInitAttrs = { ["data-bslib-card-init"]: "" };

const kBsTabsetCardHeaderClasses = ["bslib-navs-card-title"];
const kQuartoHideTitleClass = "dashboard-card-no-title";

// BSLib Card Attributes
const kBsCardAttributes: Record<string, string> = {
  ["data-bslib-card-init"]: "",
  ["data-require-bs-caller"]: "card()",
};

// How to process card attributes (card attributes express options that the
// user has provided via markdown) - this converts them into their final rendered
// form (e.g. turn a height attribute into a css style enforcing height)
const cardAttrHandlers = (doc: Document, dashboardMeta: DashboardMeta) => {
  return [
    {
      attr: kAttrExpandable,
      handle: (el: Element, attrValue: string) => {
        if (attrValue !== "false") {
          const shellEl = doc.createElement("DIV");
          shellEl.innerHTML = kExpandBtnHtml;
          for (const childEl of shellEl.children) {
            el.appendChild(childEl);
          }
          el.setAttribute(kAttrFullScreen, "false");
        }
      },
      defaultValue: (el: Element) => {
        if (el.classList.contains(kValueboxClass) || hasFlowLayout(el)) {
          return "false";
        } else {
          return dashboardMeta.expandable ? "true" : "false";
        }
      },
    },
    {
      attr: kAttrMaxHeight,
      handle: ensureCssUnits(attrToStyle("max-height")),
    },
    { attr: kAttrMinHeight, handle: ensureCssUnits(attrToStyle("min-height")) },
    { attr: kAttrHeight, handle: ensureCssUnits(attrToStyle("height")) },
    {
      attr: kAttrPadding,
      handle: ensureCssUnits(attrToCardBodyStyle("padding")),
    },
  ];
};

// How to process card body attributes (card attributes express options that the
// user has provided via markdown) - this converts them into their final rendered
// form (e.g. turn a height attribute into a css style enforcing height)
const cardBodyAttrHandlers = () => {
  return [
    {
      attr: kAttrMaxHeight,
      handle: ensureCssUnits(attrToStyle("max-height")),
    },
    { attr: kAttrMinHeight, handle: ensureCssUnits(attrToStyle("min-height")) },
    { attr: kAttrHeight, handle: ensureCssUnits(attrToStyle("height")) },
  ];
};

export function processCards(doc: Document, dashboardMeta: DashboardMeta) {
  // We need to process cards specially
  const cardNodes = doc.body.querySelectorAll(`.${kCardClass}`);
  let cardCount = 0;
  for (const cardNode of cardNodes) {
    cardCount++;
    const cardEl = cardNode as Element;

    const cardBodyEls: Element[] = [];
    let cardHeaderEl = undefined;
    for (const cardChildEl of cardEl.children) {
      if (cardChildEl.classList.contains(kCardBodyClass)) {
        cardBodyEls.push(cardChildEl);
      } else if (cardChildEl.classList.contains(kCardHeaderClass)) {
        cardHeaderEl = cardChildEl;
      }
    }

    // Loose text gets grouped into a div for alignment purposes
    // Always place this element first no matter what else is going on
    const looseText: string[] = [];
    if (cardHeaderEl) {
      // See if there is a toolbar in the header
      const cardToolbarEl = cardHeaderEl.querySelector(`.${kCardToolbarClass}`);

      for (const headerChildNode of cardHeaderEl.childNodes) {
        if (
          headerChildNode.nodeType === Node.TEXT_NODE &&
          headerChildNode.textContent.trim() !== ""
        ) {
          looseText.push(headerChildNode.textContent.trim());
          headerChildNode.parentNode?.removeChild(headerChildNode);
        }
      }

      if (looseText.length > 0) {
        // Inject the text into a div that we can use for layout
        const classes = [kCardTitleClass];

        const titleTextDiv = makeEl("DIV", { classes }, doc);
        titleTextDiv.innerText = looseText.join(" ");
        if (cardToolbarEl) {
          cardToolbarEl.insertBefore(titleTextDiv, cardToolbarEl.firstChild);
        } else {
          cardHeaderEl.insertBefore(titleTextDiv, cardHeaderEl.firstChild);
        }
      } else {
        cardHeaderEl.classList.add(kQuartoHideTitleClass);
      }
    }

    // Add card attributes
    applyClasses(cardEl, kBsCardClasses);
    applyAttributes(cardEl, kBsCardAttributes);

    // If this is a tabset, we need to do more
    const tabSetId = cardEl.classList.contains(kTabsetClass)
      ? `${kTabsetIdPrefix}${cardCount}`
      : undefined;
    if (tabSetId) {
      // Fix up the header
      if (cardHeaderEl) {
        convertToTabsetHeader(tabSetId, cardHeaderEl, cardBodyEls, doc);
      }
      // Convert the body to tabs
      convertToTabs(tabSetId, cardEl, cardBodyEls, doc);
    }

    // Process card attributes
    for (const cardAttrHandler of cardAttrHandlers(doc, dashboardMeta)) {
      const defaultValue = cardAttrHandler.defaultValue
        ? cardAttrHandler.defaultValue(cardEl)
        : undefined;
      processAndRemoveAttr(
        cardEl,
        cardAttrHandler.attr,
        cardAttrHandler.handle,
        defaultValue,
      );
    }

    // Process card body attributes
    for (const cardBodyEl of cardBodyEls) {
      for (const cardBodyAttrHandler of cardBodyAttrHandlers()) {
        processAndRemoveAttr(
          cardBodyEl,
          cardBodyAttrHandler.attr,
          cardBodyAttrHandler.handle,
        );
        if (!tabSetId) {
          // If this was converted to tab, this will already be taken care of
          recursiveApplyFillClasses(cardBodyEl);
        }
      }
    }

    // Initialize the cards
    cardEl.appendChild(initCardScript(doc));
  }
}

function initCardScript(doc: Document) {
  const scriptInitEl = doc.createElement("SCRIPT");
  applyAttributes(scriptInitEl, kBsCardScriptInitAttrs);
  scriptInitEl.innerText = "bslib.Card.initializeAllCards();";
  return scriptInitEl;
}

function convertToTabsetHeader(
  tabSetId: string,
  cardHeaderEl: Element,
  cardBodyEls: Element[],
  doc: Document,
) {
  // Decorate it
  applyClasses(cardHeaderEl, kBsTabsetCardHeaderClasses);

  // Add the tab nav element
  const ulEl = doc.createElement("UL");
  applyClasses(ulEl, ["nav", "nav-tabs", "card-header-tabs"]);
  applyAttributes(ulEl, {
    role: "tablist",
    ["data-tabsetid"]: tabSetId,
  });

  let cardBodyCount = 0;
  for (const cardBodyEl of cardBodyEls) {
    cardBodyCount++;

    // If the user has provided a title, use that
    let cardBodyTitle = cardBodyEl.getAttribute(kAttrTitle);
    if (cardBodyTitle == null) {
      cardBodyTitle = `Tab ${cardBodyCount}`;
    }

    // Add the liEls for each tab
    const liEl = doc.createElement("LI");
    applyClasses(liEl, ["nav-item"]);
    applyAttributes(liEl, { role: "presentation" });

    const aEl = doc.createElement("A");
    applyAttributes(aEl, {
      href: `#${tabSetId}-${cardBodyCount}`,
      role: "tab",
      ["data-toggle"]: "tab",
      ["data-bs-toggle"]: "tab",
      ["data-value"]: cardBodyTitle,
      ["aria-selected"]: cardBodyCount === 1 ? "true" : "false",
    });

    const clz = ["nav-link"];
    if (cardBodyCount === 1) {
      clz.push("active");
    }
    applyClasses(aEl, clz);

    aEl.innerText = cardBodyTitle;
    liEl.appendChild(aEl);

    // Add the li
    ulEl.appendChild(liEl);
  }
  cardHeaderEl.appendChild(ulEl);
}

function findFooterEl(cardEl: Element) {
  for (const childEl of cardEl.children) {
    if (childEl.classList.contains(kCardFooterClass)) {
      return childEl;
    }
  }
}

function convertToTabs(
  tabSetId: string,
  cardEl: Element,
  cardBodyEls: Element[],
  doc: Document,
) {
  const tabContainerEl = tabSetId ? doc.createElement("DIV") : undefined;
  if (tabContainerEl) {
    tabContainerEl.classList.add("tab-content");
    tabContainerEl.setAttribute("data-tabset-id", tabSetId);

    // Make sure we place this above the card footer
    const cardFooterEl = findFooterEl(cardEl);
    if (cardFooterEl) {
      cardEl.insertBefore(tabContainerEl, cardFooterEl);
    } else {
      cardEl.appendChild(tabContainerEl);
    }
  }

  let cardBodyCount = 0;
  for (const cardBodyEl of cardBodyEls) {
    cardBodyCount++;

    for (const cardBodyAttrHandler of cardBodyAttrHandlers()) {
      processAndRemoveAttr(
        cardBodyEl,
        cardBodyAttrHandler.attr,
        cardBodyAttrHandler.handle,
      );
    }

    // Deal with tabs
    if (tabContainerEl) {
      const tabPaneEl = doc.createElement("DIV");
      tabPaneEl.classList.add("tab-pane");
      if (cardBodyCount === 1) {
        tabPaneEl.classList.add("active");
        tabPaneEl.classList.add("show");
      }
      tabPaneEl.setAttribute("role", "tabpanel");
      tabPaneEl.id = `${tabSetId}-${cardBodyCount}`;
      tabPaneEl.appendChild(cardBodyEl);
      tabContainerEl.appendChild(tabPaneEl);
    }
  }

  if (tabContainerEl) {
    recursiveApplyFillClasses(tabContainerEl);
  }
}
