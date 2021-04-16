/*
* format-html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { Document } from "deno_dom/deno-dom-wasm.ts";

import { renderEjs } from "../../core/ejs.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { sessionTempFile } from "../../core/temp.ts";
import { asCssSize } from "../../core/css.ts";

import {
  kHeaderIncludes,
  kIncludeAfterBody,
  kIncludeInHeader,
} from "../../config/constants.ts";
import {
  DependencyFile,
  Format,
  FormatExtras,
  kDependencies,
  kHtmlPostprocessors,
  kSassBundles,
  SassBundle,
} from "../../config/format.ts";
import { PandocFlags } from "../../config/flags.ts";
import { kTheme } from "../../config/constants.ts";

import { createHtmlFormat } from "./../formats.ts";

import { boostrapExtras, formatHasBootstrap } from "./format-html-bootstrap.ts";

import { quartoDeclarations, quartoRules } from "./format-html-scss.ts";
import { print, sassVariable } from "../../command/render/sass.ts";

export const kCodeCopy = "code-copy";
export const kAnchorSections = "anchor-sections";
export const kPageLayout = "page-layout";
export const kHoverCitations = "hover-citations";
export const kHoverFootnotes = "hover-footnotes";
export const kComments = "comments";
export const kHypothesis = "hypothesis";
export const kUtterances = "utterances";

export const kFootnoteSectionTitle = "footnote-section-title";

export const kDocumentCss = "document-css";
export const kBootstrapDependencyName = "bootstrap";

export function htmlFormat(
  figwidth: number,
  figheight: number,
): Format {
  return mergeConfigs(
    createHtmlFormat(figwidth, figheight),
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

export function htmlFormatPostprocessor(format: Format) {
  // read options
  const codeCopy = formatHasBootstrap(format)
    ? format.metadata[kCodeCopy] !== false
    : format.metadata[kCodeCopy] || false;

  return (doc: Document): Promise<string[]> => {
    // insert code copy button
    if (codeCopy) {
      const codeBlocks = doc.querySelectorAll("pre.sourceCode");
      for (let i = 0; i < codeBlocks.length; i++) {
        const code = codeBlocks[i];

        const copyButton = doc.createElement("button");
        const title = "Copy to Clipboard";
        copyButton.setAttribute("title", title);
        copyButton.classList
          .add("code-copy-button");
        const copyIcon = doc.createElement("i");
        copyIcon.classList.add("bi");
        copyButton.appendChild(copyIcon);

        code.appendChild(copyButton);
      }
    }

    // no resource refs
    return Promise.resolve([]);
  };
}

function themeFormatExtras(flags: PandocFlags, format: Format) {
  const theme = format.metadata[kTheme];
  if (theme === "none") {
    return {
      metadata: {
        [kDocumentCss]: false,
      },
    };
  } else if (theme === "pandoc") {
    return pandocExtras(format);
  } else {
    return boostrapExtras(flags, format);
  }
}

function htmlFormatExtras(format: Format): FormatExtras {
  // lists of scripts and ejs data for the orchestration script
  const kQuartoHtmlDependency = "quarto-html";
  const scripts: DependencyFile[] = [];
  const stylesheets: DependencyFile[] = [];
  const bootstrap = formatHasBootstrap(format);
  const sassBundles: SassBundle[] = [];

  const options: Record<string, unknown> = format.metadata[kComments]
    ? {
      [kHypothesis]:
        (format.metadata[kComments] as Record<string, unknown>)[kHypothesis] ||
        false,
      [kUtterances]:
        (format.metadata[kComments] as Record<string, unknown>)[kUtterances] ||
        false,
    }
    : {};
  if (bootstrap) {
    options.copyCode = format.metadata[kCodeCopy] !== false;
    options.anchors = format.metadata[kAnchorSections] !== false;
    options.hoverCitations = format.metadata[kHoverCitations] !== false;
    options.hoverFootnotes = format.metadata[kHoverFootnotes] !== false;
  } else {
    options.copyCode = format.metadata[kCodeCopy] || false;
    options.anchors = format.metadata[kAnchorSections] || false;
    options.hoverCitations = format.metadata[kHoverCitations] || false;
    options.hoverFootnotes = format.metadata[kHoverFootnotes] || false;
  }

  // popper if required
  options.tippy = options.hoverCitations || options.hoverFootnotes;
  if (bootstrap || options.tippy) {
    scripts.push({
      name: "popper.min.js",
      path: formatResourcePath("html", join("popper", "popper.min.js")),
    });
  }

  // tippy if required
  if (options.tippy) {
    scripts.push({
      name: "tippy.umd.min.js",
      path: formatResourcePath("html", join("tippy", "tippy.umd.min.js")),
    });
    stylesheets.push({
      name: "tippy.css",
      path: formatResourcePath("html", join("tippy", "tippy.css")),
    });

    // If this is a bootstrap format, include requires sass
    if (bootstrap) {
      options.tippyTheme = "quarto";
      sassBundles.push({
        key: "tippy.scss",
        dependency: kBootstrapDependencyName,
        quarto: {
          declarations: "",
          variables: "",
          rules: Deno.readTextFileSync(
            formatResourcePath("html", join("tippy", "_tippy.scss")),
          ),
        },
      });
    } else {
      options.tippyTheme = "light-border";
      stylesheets.push({
        name: "light-border.css",
        path: formatResourcePath("html", join("tippy", "light-border.css")),
      });
    }
  }

  // clipboard.js if required
  if (options.copyCode) {
    scripts.push({
      name: "clipboard.min.js",
      path: formatResourcePath("html", join("clipboard", "clipboard.min.js")),
    });
  }

  // anchors if required
  if (options.anchors) {
    scripts.push({
      name: "anchor.min.js",
      path: formatResourcePath("html", join("anchor", "anchor.min.js")),
    });
    options.anchors = typeof (options.anchors) === "string"
      ? options.anchors
      : true;
  }

  // add main orchestion script if we have any options enabled
  const quartoHtmlRequired = Object.keys(options).some((option) =>
    !!options[option]
  );

  if (quartoHtmlRequired) {
    // html orchestration script
    const quartoHtmlScript = sessionTempFile();
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

    // add quarto sass bundle of we aren't in bootstrap
    if (!bootstrap) {
      const quartoVariables = print(
        sassVariable(
          "code-copy-selector",
          format.metadata[kCodeCopy] === "hover"
            ? '"pre.sourceCode:hover > "'
            : '""',
        ),
      );
      sassBundles.push({
        dependency: kQuartoHtmlDependency,
        key: kQuartoHtmlDependency,
        quarto: {
          use: ["sass:color"],
          variables: quartoVariables,
          declarations: quartoDeclarations(),
          rules: quartoRules(),
        },
      });
    }
  }

  // header includes
  const includeInHeader: string[] = [];

  // hypothesis
  if (options.hypothesis) {
    const hypothesisHeader = sessionTempFile({ suffix: ".html" });
    Deno.writeTextFileSync(
      hypothesisHeader,
      renderEjs(
        formatResourcePath("html", join("hypothesis", "hypothesis.ejs")),
        { hypothesis: options.hypothesis },
      ),
    );
    includeInHeader.push(hypothesisHeader);
  }

  // after body
  const includeAfterBody: string[] = [];

  // utterances
  if (options.utterances) {
    if (typeof (options.utterances) !== "object") {
      throw new Error("Invalid utterances configuration (must provide a repo");
    }
    const utterances = options.utterances as Record<string, string>;
    if (!utterances["repo"]) {
      throw new Error("Invalid utterances coniguration (must provide a repo)");
    }
    utterances["issue-term"] = utterances["issue-term"] || "pathname";
    utterances["theme"] = utterances["theme"] || "github-light";
    const utterancesAfterBody = sessionTempFile({ suffix: ".html" });
    Deno.writeTextFileSync(
      utterancesAfterBody,
      renderEjs(
        formatResourcePath("html", join("utterances", "utterances.ejs")),
        { utterances },
      ),
    );
    includeAfterBody.push(utterancesAfterBody);
  }

  // return extras
  return {
    [kIncludeInHeader]: includeInHeader,
    [kIncludeAfterBody]: includeAfterBody,
    html: {
      [kDependencies]: [{
        name: kQuartoHtmlDependency,
        scripts,
        stylesheets,
      }],
      [kSassBundles]: sassBundles,
      [kHtmlPostprocessors]: [htmlFormatPostprocessor(format)],
    },
  };
}

function pandocExtras(format: Format) {
  // see if there is a max-width
  const maxWidth = format.metadata["max-width"];
  const headerIncludes = maxWidth
    ? `<style type="text/css">body { max-width: ${
      asCssSize(maxWidth)
    };}</style>`
    : undefined;

  return {
    metadata: {
      [kDocumentCss]: true,
      [kHeaderIncludes]: headerIncludes,
    },
  };
}
