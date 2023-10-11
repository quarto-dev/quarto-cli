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
import { dashboardMeta, kDashboard } from "./format-dashboard-shared.ts";
import { processCards } from "./format-dashboard-card.ts";
import { processValueBoxes } from "./format-dashboard-valuebox.ts";
import {
  applyFillItemClasses,
  processColumns,
  processRows,
} from "./format-dashboard-layout.ts";

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
        extras[kFilterParams][kDashboard] = {
          orientation: dashboard.orientation,
          fill: dashboard.fill,
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

    // Read the dashboard metadata
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

    // Adjust the appearance of row  elements
    processRows(doc);

    // Adjust the appearance of column element
    processColumns(doc);

    // Process card
    processCards(doc);

    // Process valueboxes
    processValueBoxes(doc);

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
