/*
* format-html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { renderEjs } from "../../core/ejs.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { sessionTempFile } from "../../core/temp.ts";
import { asCssSize } from "../../core/css.ts";

import {
  kHeaderIncludes,
  kHtmlMathMethod,
  kVariables,
} from "../../config/constants.ts";
import {
  DependencyFile,
  Format,
  FormatExtras,
  kDependencies,
} from "../../config/format.ts";
import { PandocFlags } from "../../config/flags.ts";
import { Metadata } from "../../config/metadata.ts";
import { kTheme } from "../../config/constants.ts";

import { baseHtmlFormat } from "./../formats.ts";

import { boostrapExtras, formatHasBootstrap } from "./format-html-bootstrap.ts";

export const kCodeCopy = "code-copy";
export const kAnchorSections = "anchor-sections";
export const kPageLayout = "page-layout";
export const kHoverCitations = "hover-citations";
export const kHoverFootnotes = "hover-footnotes";

export const kFootnoteSectionTitle = "footnote-section-title";

export const kDocumentCss = "document-css";
export const kBootstrapDependencyName = "bootstrap";

export function htmlFormat(
  figwidth: number,
  figheight: number,
): Format {
  return mergeConfigs(
    baseHtmlFormat(figwidth, figheight),
    {
      pandoc: {
        [kHtmlMathMethod]: "mathjax",
      },
    },
    {
      formatExtras: (flags: PandocFlags, format: Format) => {
        return mergeConfigs(
          htmlFormatExtras(format),
          themeFormatExtras(flags, format),
        );
      },
    },
  );
}

function themeFormatExtras(flags: PandocFlags, format: Format) {
  const theme = format.metadata[kTheme];
  if (theme === "none") {
    return {
      pandoc: {
        [kVariables]: {
          [kDocumentCss]: false,
        },
      },
    };
  } else if (theme === "pandoc") {
    return pandocExtras(format.metadata);
  } else {
    return boostrapExtras(flags, format);
  }
}

function htmlFormatExtras(format: Format): FormatExtras {
  // lists of scripts and ejs data for the orchestration script
  const scripts: DependencyFile[] = [];
  const stylesheets: DependencyFile[] = [];
  const bootstrap = formatHasBootstrap(format);
  const options: Record<string, unknown> = {
    copyCode: format.metadata[kCodeCopy] !== false &&
      formatHasBootstrap(format),
    anchors: format.metadata[kAnchorSections],
    hoverCitations: format.metadata[kHoverCitations] !== false,
    hoverFootnotes: format.metadata[kHoverFootnotes] !== false,
  };

  // popper if required
  const tippy = options.hoverCitations || options.hoverFootnotes;
  if (bootstrap || tippy) {
    scripts.push({
      name: "popper.min.js",
      path: formatResourcePath("html", join("popper", "popper.min.js")),
    });
  }

  // tippy if required
  if (tippy) {
    scripts.push({
      name: "tippy.umd.min.js",
      path: formatResourcePath("html", join("tippy", "tippy.umd.min.js")),
    });
    stylesheets.push({
      name: "tippy.css",
      path: formatResourcePath("html", join("tippy", "tippy.css")),
    });
    stylesheets.push({
      name: "light-border.css",
      path: formatResourcePath("html", join("tippy", "light-border.css")),
    });
  }

  // clipboard.js if required
  if (options.copyCode) {
    scripts.push({
      name: "clipboard.min.js",
      path: formatResourcePath("html", join("clipboard", "clipboard.min.js")),
    });
  }

  // anchors if required
  if (options.anchors !== false) {
    scripts.push({
      name: "anchor.min.js",
      path: formatResourcePath("html", join("anchor", "anchor.min.js")),
    });
    options.anchors = typeof (options.anchors) === "string"
      ? options.anchors
      : true;
  }

  // add main orchestion script
  const quartoHtmlScript = sessionTempFile({ suffix: ".html" });
  Deno.writeTextFileSync(
    quartoHtmlScript,
    renderEjs(
      formatResourcePath("html", join("templates", "quarto-html.ejs.js")),
      options,
    ),
  );

  scripts.push({
    name: "quarto-html.js",
    path: quartoHtmlScript,
  });

  // return extras
  return {
    [kDependencies]: [{
      name: "quarto-html",
      scripts,
      stylesheets,
    }],
  };
}

function pandocExtras(metadata: Metadata) {
  // see if there is a max-width
  const maxWidth = metadata["max-width"];
  const headerIncludes = maxWidth
    ? `<style type="text/css">body { max-width: ${
      asCssSize(maxWidth)
    };}</style>`
    : undefined;

  return {
    pandoc: {
      [kVariables]: {
        [kDocumentCss]: true,
        [kHeaderIncludes]: headerIncludes,
      },
    },
  };
}
