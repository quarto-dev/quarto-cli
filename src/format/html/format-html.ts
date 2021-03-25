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
import { baseHtmlFormat } from "./../formats.ts";

import { boostrapExtras, formatHasBootstrap } from "./format-html-bootstrap.ts";

export const kDefaultTheme = "default";

export const kTheme = "theme";
export const kCodeCopy = "code-copy";
export const kAnchorSections = "anchor-sections";
export const kPageLayout = "page-layout";
export const kHoverCitations = "hover-citations";
export const kHoverFootnotes = "hover-footnotes";

export const kDocumentCss = "document-css";
export const kBootstrapDependencyName = "bootstrap";

export function htmlFormat(
  figwidth: number,
  figheight: number,
): Format {
  return mergeConfigs(
    baseHtmlFormat(figwidth, figheight),
    {
      metadata: {
        [kTheme]: kDefaultTheme,
      },
      pandoc: {
        [kHtmlMathMethod]: "mathjax",
      },
    },
    {
      formatExtras: (flags: PandocFlags, format: Format) => {
        return mergeConfigs(
          themeFormatExtras(flags, format),
          htmlFormatExtras(format),
        );
      },
    },
  );
}

function themeFormatExtras(flags: PandocFlags, format: Format) {
  if (format.metadata[kTheme]) {
    const themeRaw = format.metadata[kTheme];
    if (typeof (themeRaw) === "string" && themeRaw === "pandoc") {
      // 'pandoc' theme means include default pandoc document css
      return Promise.resolve(pandocExtras(format.metadata));
    } else {
      // other themes are bootswatch themes or bootstrap css files
      return boostrapExtras(flags, format);
    }

    // theme: null means no default document css at all
  } else {
    return Promise.resolve({
      pandoc: {
        [kVariables]: {
          [kDocumentCss]: false,
        },
      },
    });
  }
}

function htmlFormatExtras(format: Format): FormatExtras {
  // lists of scripts and ejs data for the orchestration script
  const scripts: DependencyFile[] = [];
  const options: Record<string, unknown> = {
    copyCode: format.metadata[kCodeCopy] !== false &&
      formatHasBootstrap(format),
    anchors: format.metadata[kAnchorSections],
    hoverCitations: format.metadata[kHoverCitations] !== false &&
      formatHasBootstrap(format),
    hoverFootnotes: format.metadata[kHoverFootnotes] !== false &&
      formatHasBootstrap(format),
  };

  // clipboard.js if requested
  if (options.copyCode) {
    scripts.push({
      name: "clipboard.min.js",
      path: formatResourcePath("html", join("clipboard", "clipboard.min.js")),
    });
  }

  // anchors if requested
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
