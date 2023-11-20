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
  kIpynbShellInteractivity,
  kPlotlyConnected,
  kTemplate,
  kTheme,
  kWarning,
} from "../../config/constants.ts";
import {
  DependencyHtmlFile,
  Format,
  FormatExtras,
  kDependencies,
  kHtmlPostprocessors,
  kSassBundles,
  Metadata,
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
import {
  DashboardMeta,
  dashboardMeta,
  dashboardScssLayer,
  kDashboard,
  kDontMutateTags,
} from "./format-dashboard-shared.ts";
import { processCards } from "./format-dashboard-card.ts";
import { processValueBoxes } from "./format-dashboard-valuebox.ts";
import {
  applyFillItemClasses,
  processColumns,
  processRows,
} from "./format-dashboard-layout.ts";
import { processSidebars } from "./format-dashboard-sidebar.ts";
import { kTemplatePartials } from "../../command/render/template.ts";
import { processPages } from "./format-dashboard-page.ts";
import { processNavButtons } from "./format-dashboard-navbutton.ts";
import { processNavigation } from "./format-dashboard-website.ts";
import { projectIsWebsite } from "../../project/project-shared.ts";
import { processShinyComponents } from "./format-dashboard-shiny.ts";
import { processToolbars } from "./format-dashboard-toolbar.ts";
import { processDatatables } from "./format-dashboard-tables.ts";

const kDashboardClz = "quarto-dashboard";

export function dashboardFormat() {
  // use ~ the golden ratio
  const baseHtmlFormat = htmlFormat(8, 5);
  const dashboardFormat = mergeConfigs(
    baseHtmlFormat,
    {
      execute: {
        [kEcho]: false,
        [kWarning]: false,
        [kIpynbShellInteractivity]: "all",
        [kPlotlyConnected]: false,
      },
      metadata: {
        [kPageLayout]: kPageLayoutCustom,
        [kTemplatePartials]: formatResourcePath(
          "dashboard",
          "title-block.html",
        ),
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
        // Read the dashboard metadata
        const dashboard = await dashboardMeta(format);

        const isWebsiteProject = projectIsWebsite(project);

        // Forward the theme along (from either the html format
        // or from the dashboard format)
        // TODO: There must be a beter way to do this
        if (isWebsiteProject) {
          const formats: Record<string, Metadata> = format.metadata
            .format as Record<string, Metadata>;
          const htmlFormat = formats["html"];
          if (htmlFormat && htmlFormat[kTheme]) {
            format.metadata[kTheme] = htmlFormat[kTheme];
          }
        }

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
          dashboardHtmlPostProcessor(dashboard),
        );

        extras[kFilterParams] = extras[kFilterParams] || {};
        extras[kFilterParams][kDashboard] = {
          orientation: dashboard.orientation,
          scrolling: dashboard.scrolling,
        };

        if (!isWebsiteProject) {
          // If this is a website project, it will inject the scss for dashboards
          extras.html[kSassBundles] = extras.html[kSassBundles] || [];
          extras.html[kSassBundles].push(dashboardScssLayer());
        }

        const scripts: DependencyHtmlFile[] = [];
        const stylesheets: DependencyHtmlFile[] = [];

        // Add the js script which we can use in dashboard to make client side
        // adjustments
        scripts.push({
          name: "quarto-dashboard.js",
          path: formatResourcePath("dashboard", "quarto-dashboard.js"),
        });

        // Add the sticky headers script
        scripts.push({
          name: "stickythead.js",
          path: formatResourcePath("dashboard", join("js", "stickythead.js")),
        });

        // Add the DT scripts and CSS
        // Note that the `tables` processing may remove this if no connected / matching DT tables
        // are detected
        scripts.push({
          name: "datatables.min.js",
          path: formatResourcePath(
            "dashboard",
            join("js", "dt", "datatables.min.js"),
          ),
          attribs: {
            kDTTableSentinel: "true",
          },
        });
        stylesheets.push({
          name: "datatables.min.css",
          path: formatResourcePath(
            "dashboard",
            join("js", "dt", "datatables.min.css"),
          ),
          attribs: {
            kDTTableSentinel: "true",
          },
        });
        scripts.push({
          name: "pdfmake.min.js",
          path: formatResourcePath(
            "dashboard",
            join("js", "dt", "pdfmake.min.js"),
          ),
          attribs: {
            kDTTableSentinel: "true",
          },
        });
        scripts.push({
          name: "vfs_fonts.js",
          path: formatResourcePath(
            "dashboard",
            join("js", "dt", "vfs_fonts.js"),
          ),
          attribs: {
            kDTTableSentinel: "true",
          },
        });

        const componentDir = join(
          "bslib",
          "components",
          "dist",
        );

        [{
          name: "web-components",
          module: true,
        }, { name: "components", module: false }].forEach(
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
  dashboardMeta: DashboardMeta,
) {
  return (doc: Document): Promise<HtmlPostProcessResult> => {
    const result: HtmlPostProcessResult = {
      resources: [],
      supporting: [],
    };

    // Mark the body as a quarto dashboard
    doc.body.classList.add(kDashboardClz);

    // Note the orientation as fill if needed
    if (!dashboardMeta.scrolling) {
      doc.body.classList.add("dashboard-fill");
    }

    // Mark the page container with layout instructions
    const containerEl = doc.querySelector("div.page-layout-custom");
    if (containerEl) {
      const containerClz = [
        "quarto-dashboard-content",
        "bslib-gap-spacing",
        "html-fill-container",
      ];

      // The scrolling behavior
      if (!dashboardMeta.scrolling) {
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
        if (
          !childEl.classList.contains("quarto-title-block") &&
          !kDontMutateTags.includes(childEl.tagName.toUpperCase())
        ) {
          childEl.classList.add("bslib-grid-item");
          applyFillItemClasses(childEl);
        }
      }
    }

    // Helper for forwarding supporting and resources
    const addResults = (
      res: {
        resources: string[];
        supporting: string[];
      } | undefined,
    ) => {
      if (res) {
        result.resources.push(...res.resources);
        result.supporting.push(...res.supporting);
      }
    };

    // Process Data Tables
    addResults(processDatatables(doc));

    // Process navigation
    processNavigation(doc);

    // Process pages that may be present in the document
    processPages(doc);

    // Process Navbar buttons
    processNavButtons(doc, dashboardMeta);

    // Adjust the appearance of row  elements
    processRows(doc);

    // Adjust the appearance of column element
    processColumns(doc);

    // Process card
    processCards(doc, dashboardMeta);

    // Process valueboxes
    processValueBoxes(doc);

    // Process sidedars
    processSidebars(doc);

    // Process toolbars
    processToolbars(doc);

    // Process tables
    processTables(doc);

    // Process Shiny Specific Components
    processShinyComponents(doc);

    // Process fill images to include proper fill behavior
    const imgFillSelectors = [
      "div.cell-output-display > div.quarto-figure > .quarto-float img",
      "div.cell-output-display > img",
    ];
    imgFillSelectors.forEach((selector) => {
      const fillImgNodes = doc.body.querySelectorAll(selector);
      for (const fillImgNode of fillImgNodes) {
        const fillImgEl = fillImgNode as Element;
        fillImgEl.classList.add("quarto-dashboard-img-contain");
        fillImgEl.removeAttribute("height");
        fillImgEl.removeAttribute("width");
      }
    });

    return Promise.resolve(result);
  };
}

function processTables(doc: Document) {
  doc.querySelectorAll(".itables table").forEach((tableEl) => {
    (tableEl as Element).setAttribute("style", "width:100%;");
  });
}
