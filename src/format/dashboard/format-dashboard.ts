import {
  HtmlPostProcessResult,
  RenderServices,
} from "../../command/render/types.ts";
import {
  kEcho,
  kIncludeAfterBody,
  kTemplate,
  kWarning,
} from "../../config/constants.ts";
import {
  DependencyFile,
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

        const scripts: DependencyFile[] = [];
        ["accordion", "card", "sidebar", "webcomponents"].forEach(
          (name) => {
            const component = join(
              "bslib",
              "components",
              "dist",
              name,
              `${name}.min.js`,
            );
            scripts.push({
              name: `${name}.min.js`,
              path: formatResourcePath("html", component),
            });
          },
        );
        extras.html[kDependencies] = extras.html[kDependencies] || [];
        extras.html[kDependencies].push({
          name: "quarto-dashboard",
          scripts,
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
  _format: Format,
) {
  return (doc: Document): Promise<HtmlPostProcessResult> => {
    const result: HtmlPostProcessResult = {
      resources: [],
      supporting: [],
    };

    // Mark the body as a quarto dashboard
    doc.body.classList.add(kDashboardClz);

    // Mark the page container with layout instructions
    const containerEl = doc.querySelector("div.page-layout-custom");
    if (containerEl) {
      ["bslib-page-fill", "bslib-gap-spacing", "html-fill-container"].forEach(
        (clz) => {
          containerEl.classList.add(clz);
        },
      );
    }

    // Mark the children with layout instructions
    const children = containerEl?.children;
    if (children) {
      for (const childEl of children) {
        // All the children of the dashboard container at the root level become
        // fill children
        if (!childEl.classList.contains("quarto-title-block")) {
          childEl.classList.add("html-fill-item");
          childEl.classList.add("bslib-grid-item");
        }
      }
    }

    const recursiveFill = (el: Element) => {
      el.classList.add("html-fill-item");
      el.classList.add("html-fill-container");
      for (const childEl of el.children) {
        recursiveFill(childEl);
      }
    };

    // We need to process cards specially
    const cardNodes = doc.body.querySelectorAll(".card");
    for (const cardNode of cardNodes) {
      const cardEl = cardNode as Element;
      cardEl.classList.add("bslib-card");
      cardEl.classList.add("html-fill-container");
      cardEl.setAttribute("data-bslib-card-init", "");
      cardEl.setAttribute("data-full-screen", "false");
      cardEl.setAttribute("data-require-bs-caller", "card()");

      const cardBodyEl = cardEl.querySelector(".card-body");
      if (cardBodyEl) {
        recursiveFill(cardBodyEl);
      }

      const shellEl = doc.createElement("div");
      shellEl.innerHTML = expandBtnHtml;
      while (shellEl.children.length > 0) {
        cardEl.appendChild(shellEl.children[0]);
      }
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
const expandBtnHtml = `
<bslib-tooltip placement="auto">
    <template>Expand</template>
    <span class="bslib-full-screen-enter badge rounded-pill">
        <svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 24 24" style="height:1em;width:1em;" aria-hidden="true" role="img"><path d="M20 5C20 4.4 19.6 4 19 4H13C12.4 4 12 3.6 12 3C12 2.4 12.4 2 13 2H21C21.6 2 22 2.4 22 3V11C22 11.6 21.6 12 21 12C20.4 12 20 11.6 20 11V5ZM4 19C4 19.6 4.4 20 5 20H11C11.6 20 12 20.4 12 21C12 21.6 11.6 22 11 22H3C2.4 22 2 21.6 2 21V13C2 12.4 2.4 12 3 12C3.6 12 4 12.4 4 13V19Z"></path></svg>
    </span>
</bslib-tooltip>
`;
