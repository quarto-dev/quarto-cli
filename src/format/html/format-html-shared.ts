/*
* format-html-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { outputVariable, sassVariable } from "../../core/sass.ts";
import { kCodeOverflow, kLinkExternalIcon } from "../../config/constants.ts";
import { Format, FormatDependency } from "../../config/types.ts";

import { formatResourcePath } from "../../core/resources.ts";

// features that are enabled by default for 'html'. setting
// all of these to false will yield the minimal html output
// that quarto can produce (there is still some CSS we generate
// to provide figure layout, etc.). you can also set the
// 'minimal' option to do this in one shot
export const kTabsets = "tabsets";
export const kCodeCopy = "code-copy";
export const kAnchorSections = "anchor-sections";
export const kHoverCitations = "hover-citations";
export const kHoverFootnotes = "hover-footnotes";

// turn off optional html features as well as all themes
export const kMinimal = "minimal";

export const kPageLayout = "page-layout";
export const kPageLayoutArticle = "article";
export const kPageLayoutCustom = "custom";
export const kPageLayoutNone = "none";
export const kComments = "comments";
export const kHypothesis = "hypothesis";
export const kUtterances = "utterances";

export const kFootnoteSectionTitle = "footnote-section-title";

export const kDocumentCss = "document-css";
export const kBootstrapDependencyName = "bootstrap";

export const clipboardDependency = () => {
  const dependency: FormatDependency = { name: "clipboard" };
  dependency.scripts = [];
  dependency.scripts.push({
    name: "clipboard.min.js",
    path: formatResourcePath("html", join("clipboard", "clipboard.min.js")),
  });
  return dependency;
};

export const quartoRules = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-rules.scss",
  ));

export const quartoCopyCodeRules = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-rules-copy-code.scss",
  ));

export const quartoLinkExternalRules = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-rules-link-external.scss",
  ));

export const quartoGlobalCssVariableRules = () => {
  return `
  $font-family-monospace: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !default;
  /*! quarto-variables-start */
  :root {
    --quarto-font-monospace: #{inspect($font-family-monospace)};
  }
  /*! quarto-variables-end */
  `;
};

export const quartoBootstrapRules = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-rules.scss"),
  ));

export const quartoBootstrapMixins = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-mixins.scss"),
  ));

export const quartoBootstrapFunctions = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-functions.scss"),
  ));

export const quartoBaseLayer = (format: Format, codeCopyDefault = false) => {
  const rules: string[] = [quartoRules()];
  if (!!format.metadata[kCodeCopy] || codeCopyDefault) {
    rules.push(quartoCopyCodeRules());
  }
  if (format.render[kLinkExternalIcon]) {
    rules.push(quartoLinkExternalRules());
  }

  return {
    use: ["sass:color", "sass:map", "sass:math"],
    defaults: [
      quartoDefaults(format),
    ].join("\n"),
    functions: quartoFunctions(),
    mixins: "",
    rules: rules.join("\n"),
  };
};

export const quartoFunctions = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-functions.scss",
  ));

export const quartoDefaults = (format: Format) => {
  const defaults: string[] = [];
  defaults.push(
    outputVariable(
      sassVariable(
        "code-copy-selector",
        format.metadata[kCodeCopy] === undefined ||
          format.metadata[kCodeCopy] === "hover"
          ? '"pre.sourceCode:hover > "'
          : '""',
      ),
    ),
  );
  defaults.push(
    outputVariable(
      sassVariable(
        "code-white-space",
        format.render[kCodeOverflow] === "wrap" ? "pre-wrap" : "pre",
      ),
    ),
  );
  return defaults.join("\n");
};
