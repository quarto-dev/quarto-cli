/*
 * format-dashboard.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  HtmlPostProcessResult,
  RenderServices,
} from "../../command/render/types.ts";
import {
  kEcho,
  kFilterParams,
  kIncludeAfterBody,
  kTemplate,
  kWarning,
} from "../../config/constants.ts";
import {
  DependencyFile,
  DependencyHtmlFile,
  Format,
  FormatExtras,
  kDependencies,
  kHtmlPostprocessors,
} from "../../config/types.ts";
import { PandocFlags } from "../../config/types.ts";
import { mergeConfigs } from "../../core/config.ts";
import { Document, Element } from "../../core/deno-dom.ts";
import { InternalError } from "../../core/lib/error.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { ProjectContext } from "../../project/types.ts";
import { registerWriterFormatHandler } from "../format-handlers.ts";
import { kPageLayout, kPageLayoutCustom } from "../html/format-html-shared.ts";
import { htmlFormat } from "../html/format-html.ts";

import { join } from "path/mod.ts";
import { dashboardMeta } from "./format-dashboard-shared.ts";

const kDashboardClz = "quarto-dashboard";

export function dashboardFormat() {
  const baseHtmlFormat = htmlFormat(7, 5);
  const dashboardFormat = mergeConfigs(
    baseHtmlFormat,
    {
      execute: {
        [kEcho]: false,
        [kWarning]: false,
      },
      metadata: {
        [kPageLayout]: kPageLayoutCustom,
      },
      pandoc: {
        [kTemplate]: formatResourcePath("dashboard", "template.html"),
      },
    },
  );

  if (baseHtmlFormat.formatExtras) {
    const dashboardExtras = async (
      input: string,
      markdown: string,
      flags: PandocFlags,
      format: Format,
      libDir: string,
      services: RenderServices,
      offset?: string,
      project?: ProjectContext,
      quiet?: boolean,
    ) => {
      if (baseHtmlFormat.formatExtras) {
        const extras: FormatExtras = await baseHtmlFormat.formatExtras(
          input,
          markdown,
          flags,
          format,
          libDir,
          services,
          offset,
          project,
          quiet,
        );
        extras.html = extras.html || {};
        extras.html[kHtmlPostprocessors] = extras.html[kHtmlPostprocessors] ||
          [];
        extras.html[kHtmlPostprocessors].push(
          dashboardHtmlPostProcessor(format),
        );

        const dashboard = dashboardMeta(format);
        extras[kFilterParams] = extras[kFilterParams] || {};
        extras[kFilterParams]["dashboard"] = {
          orientation: dashboard.orientation,
        };

        const scripts: DependencyHtmlFile[] = [];
        const stylesheets: DependencyFile[] = [];

        const componentDir = join(
          "bslib",
          "components",
          "dist",
        );

        [{ name: "components", module: false }, {
          name: "web-components",
          module: true,
        }].forEach(
          (dependency) => {
            const attribs: Record<string, string> = {};
            if (dependency.module) {
              attribs["type"] = "module";
            }

            scripts.push({
              name: `${dependency.name}.js`,
              path: formatResourcePath(
                "html",
                join(componentDir, `${dependency.name}.js`),
              ),
              attribs,
            });
          },
        );

        stylesheets.push({
          name: `components.css`,
          path: formatResourcePath(
            "html",
            join("bslib", "components", "dist", "components.css"),
          ),
        });

        stylesheets.push({
          name: `sidebar.css`,
          path: formatResourcePath(
            "html",
            join("bslib", "components", "dist", "sidebar", "sidebar.css"),
          ),
        });

        extras.html[kDependencies] = extras.html[kDependencies] || [];
        extras.html[kDependencies].push({
          name: "quarto-dashboard",
          scripts,
          stylesheets,
        });

        extras[kIncludeAfterBody] = extras[kIncludeAfterBody] || [];

        return extras;
      } else {
        throw new InternalError(
          "Dashboard superclass must provide a format extras",
        );
      }
    };

    if (dashboardExtras) {
      dashboardFormat.formatExtras = dashboardExtras;
    }
  }

  return dashboardFormat;
}

registerWriterFormatHandler((format) => {
  switch (format) {
    case "dashboard":
      return {
        format: dashboardFormat(),
        pandocTo: "html",
      };
  }
});

function dashboardHtmlPostProcessor(
  format: Format,
) {
  return (doc: Document): Promise<HtmlPostProcessResult> => {
    const result: HtmlPostProcessResult = {
      resources: [],
      supporting: [],
    };

    const dashboard = dashboardMeta(format);

    // Mark the body as a quarto dashboard
    doc.body.classList.add(kDashboardClz);

    // Mark the page container with layout instructions
    const containerEl = doc.querySelector("div.page-layout-custom");
    if (containerEl) {
      const containerClz = [
        "bslib-gap-spacing",
        "html-fill-container",
      ];

      // The baseline page layout
      if (dashboard.orientation === "columns") {
        containerClz.push("orientation-rows");
      } else {
        containerClz.push("orientation-columns");
      }

      // The scrolling behavior
      if (dashboard.fill) {
        containerClz.push("bslib-page-fill"); // only apply this if we aren't scrolling
      } else {
        containerClz.push("dashboard-scrolling"); // only apply this if we are scrolling
      }

      containerClz.forEach(
        (clz) => {
          containerEl.classList.add(clz);
        },
      );
    }

    // Adjust the appearance of row  elements
    const rowNodes = doc.querySelectorAll("div.rows");
    if (rowNodes !== null) {
      for (const rowNode of rowNodes) {
        const rowEl = rowNode as Element;
        rowEl.classList.add("bslib-grid");
        rowEl.classList.remove("rows");

        let rowSize = "max-content";
        if (rowEl.classList.contains("fill")) {
          rowEl.classList.remove("fill");
          rowSize = "1fr";
          rowEl.classList.add("html-fill-container");
        }

        const rowCount = rowEl.childElementCount;
        const currentStyle = rowEl.getAttribute("style");
        const template =
          `display: grid; grid-template-rows:repeat(${rowCount}, minmax(0, ${rowSize}));\ngrid-auto-columns:1fr;`;
        rowEl.setAttribute(
          "style",
          currentStyle === null ? template : `${currentStyle}\n${template}`,
        );
      }
    }

    // Adjust the appearance of column element
    const colNodes = doc.querySelectorAll("div.columns");
    if (colNodes !== null) {
      for (const colNode of colNodes) {
        const colEl = colNode as Element;
        colEl.classList.add("bslib-grid");
        colEl.classList.remove("columns");

        const colSize = "1fr";
        if (colEl.classList.contains("fill")) {
          colEl.classList.remove("fill");
          colEl.classList.add("html-fill-container");
        } else {
          colEl.classList.add("no-fill");
        }
        const colCount = colEl.childElementCount;
        const currentStyle = colEl.getAttribute("style");
        const template =
          `display: grid; grid-template-columns:repeat(${colCount}, minmax(0, ${colSize}));\ngrid-auto-rows:1fr;`;
        colEl.setAttribute(
          "style",
          currentStyle === null ? template : `${currentStyle}\n${template}`,
        );
      }
    }

    // Mark the children with layout instructions
    const children = containerEl?.children;
    if (children) {
      for (const childEl of children) {
        // All the children of the dashboard container at the root level become
        // fill children
        if (!childEl.classList.contains("quarto-title-block")) {
          childEl.classList.add("bslib-grid-item");
          applyFillItemClasses(childEl);
        }
      }
    }

    // We need to process cards specially
    const cardNodes = doc.body.querySelectorAll(".card");
    let cardCount = 0;
    for (const cardNode of cardNodes) {
      cardCount++;
      const cardEl = cardNode as Element;
      const cardBodyNodes = cardEl.querySelectorAll(".card-body");

      // Add card attributes
      cardEl.classList.add("bslib-card");
      cardEl.classList.add("html-fill-container");
      cardEl.setAttribute("data-bslib-card-init", "");
      cardEl.setAttribute("data-require-bs-caller", "card()");

      // If this is a tabset, we need to do more
      const tabSetId = cardEl.classList.contains("tabset")
        ? `card-tabset-${cardCount}`
        : undefined;

      if (tabSetId) {
        // Fix up the header
        const cardHeaderEl = cardEl.querySelector(".card-header");
        if (cardHeaderEl) {
          // Decorate it
          cardHeaderEl.classList.add("bslib-navs-card-title");

          // Add the tab nav element
          const ulEl = doc.createElement("UL");
          ["nav", "nav-tabs", "card-header-tabs"].forEach((clz) => {
            ulEl.classList.add(clz);
          });
          ulEl.setAttribute("role", "tablist");
          ulEl.setAttribute("data-tabsetid", tabSetId);

          let cardBodyCount = 0;
          for (const cardBodyNode of cardBodyNodes) {
            cardBodyCount++;
            const cardBodyEl = cardBodyNode as Element;
            let cardBodyTitle = cardBodyEl.getAttribute("data-title");
            if (cardBodyTitle == null) {
              cardBodyTitle = `Tab ${cardBodyCount}`;
            }

            // Add the liEls for each tab
            const liEl = doc.createElement("LI");
            liEl.classList.add("nav-item");
            liEl.setAttribute("role", "presentation");

            const aEl = doc.createElement("A");
            aEl.setAttribute("href", `#${tabSetId}-${cardBodyCount}`);
            aEl.classList.add("nav-link");
            if (cardBodyCount === 1) {
              aEl.classList.add("active");
            }

            aEl.setAttribute("role", "tab");
            aEl.setAttribute("data-toggle", "tab");
            aEl.setAttribute("data-bs-toggle", "tab");
            aEl.setAttribute(
              "data-value",
              cardBodyTitle,
            );
            aEl.setAttribute("aria-selected", "true");
            aEl.innerText = cardBodyTitle;
            liEl.appendChild(aEl);

            // Add the li
            ulEl.appendChild(liEl);
          }

          cardHeaderEl.appendChild(ulEl);
        }
      }

      for (const cardAttrHandler of cardAttrHandlers(doc)) {
        processAndRemoveAttr(
          cardEl,
          cardAttrHandler.attr,
          cardAttrHandler.handle,
        );
      }

      const tabContainerEl = tabSetId ? doc.createElement("DIV") : undefined;
      if (tabContainerEl) {
        tabContainerEl.classList.add("tab-content");
        tabContainerEl.setAttribute("data-tabset-id", tabSetId);
        cardEl.appendChild(tabContainerEl);
      }

      let cardBodyCount = 0;
      for (const cardBodyNode of cardBodyNodes) {
        cardBodyCount++;
        const cardBodyEl = cardBodyNode as Element;

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
        } else {
          recursiveApplyFillClasses(cardBodyEl);
        }
      }

      if (tabContainerEl) {
        recursiveApplyFillClasses(tabContainerEl);
      }

      // Initialize the cards
      const scriptInitEl = doc.createElement("script");
      scriptInitEl.setAttribute("data-bslib-card-init", "");
      scriptInitEl.innerText = "bslib.Card.initializeAllCards();";
      cardEl.appendChild(scriptInitEl);
    }

    // Process value boxes
    const valueboxNodes = doc.body.querySelectorAll(
      ".valuebox > .card-body > div",
    );
    for (const valueboxNode of valueboxNodes) {
      const valueboxEl = valueboxNode as Element;
      valueboxEl.classList.add("bslib-value-box");
      valueboxEl.classList.add("value-box-grid");
    }

    // Process fill images to include proper fill behavior
    const fillImgNodes = doc.body.querySelectorAll("img.html-fill-item");
    for (const fillImgNode of fillImgNodes) {
      const fillImgEl = fillImgNode as Element;
      fillImgEl.classList.add("quarto-dashboard-img-contain");
      fillImgEl.removeAttribute("height");
      fillImgEl.removeAttribute("width");
    }

    return Promise.resolve(result);
  };
}

const cardAttrHandlers = (doc: Document) => {
  return [
    {
      attr: "data-expandable",
      handle: (el: Element, attrValue: string) => {
        if (attrValue === "true") {
          const shellEl = doc.createElement("div");
          shellEl.innerHTML = expandBtnHtml;
          for (const childEl of shellEl.children) {
            el.appendChild(childEl);
          }
          el.setAttribute("data-full-screen", "false");
        }
      },
    },
    {
      attr: "data-max-height",
      handle: attrToStyle("max-height"),
    },
    { attr: "data-min-height", handle: attrToStyle("min-height") },
    { attr: "data-height", handle: attrToStyle("height") },
    { attr: "data-padding", handle: attrToCardBodyStyle("padding") },
  ];
};

const cardBodyAttrHandlers = () => {
  return [
    {
      attr: "data-max-height",
      handle: attrToStyle("max-height"),
    },
    { attr: "data-min-height", handle: attrToStyle("min-height") },
    { attr: "data-height", handle: attrToStyle("height") },
  ];
};

const processAndRemoveAttr = (
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

const attrToStyle = (style: string) => {
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

const attrToCardBodyStyle = (style: string) => {
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

const expandBtnHtml = `
<bslib-tooltip placement="auto" bsoptions="[]" data-require-bs-version="5" data-require-bs-caller="tooltip()">
    <template>Expand</template>
    <span class="bslib-full-screen-enter badge rounded-pill">
        <svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 24 24" style="height:1em;width:1em;" aria-hidden="true" role="img"><path d="M20 5C20 4.4 19.6 4 19 4H13C12.4 4 12 3.6 12 3C12 2.4 12.4 2 13 2H21C21.6 2 22 2.4 22 3V11C22 11.6 21.6 12 21 12C20.4 12 20 11.6 20 11V5ZM4 19C4 19.6 4.4 20 5 20H11C11.6 20 12 20.4 12 21C12 21.6 11.6 22 11 22H3C2.4 22 2 21.6 2 21V13C2 12.4 2.4 12 3 12C3.6 12 4 12.4 4 13V19Z"></path></svg>
    </span>
</bslib-tooltip>
`;

const recursiveApplyFillClasses = (el: Element) => {
  applyFillItemClasses(el);
  applyFillContainerClasses(el);
  for (const childEl of el.children) {
    recursiveApplyFillClasses(childEl);
  }
};

const applyFillItemClasses = (el: Element) => {
  const skipFill = kSkipFillClz.some((clz) => {
    return el.classList.contains(clz) || kSkipFillTagz.includes(el.tagName);
  });
  if (!skipFill) {
    el.classList.add("html-fill-item");
  }
};

const applyFillContainerClasses = (el: Element) => {
  const skipContainer = kSkipContainerClz.some((clz) => {
    return el.classList.contains(clz) ||
      kSkipContainerTagz.includes(el.tagName);
  });
  if (!skipContainer) {
    el.classList.add("html-fill-container");
  }
};

const kSkipContainerTagz = ["P", "FIGCAPTION", "SCRIPT"];
const kSkipContainerClz: string[] = [
  "bi",
  "value-box-grid",
  "value-box-area",
  "value-box-title",
  "value-box-value",
];
const kSkipFillClz: string[] = ["bi", "no-fill", "callout"];
const kSkipFillTagz = ["P", "FIGCAPTION", "SCRIPT"];
