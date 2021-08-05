/*
* format-html-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { print, sassVariable } from "../../core/sass.ts";
import { kCodeOverflow } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";

import { formatResourcePath } from "../../core/resources.ts";

export const kCodeCopy = "code-copy";
export const kAnchorSections = "anchor-sections";
export const kPageLayout = "page-layout";
export const kPageLayoutArticle = "article";
export const kPageLayoutCustom = "custom";
export const kPageLayoutNone = "none";
export const kHoverCitations = "hover-citations";
export const kHoverFootnotes = "hover-footnotes";
export const kComments = "comments";
export const kHypothesis = "hypothesis";
export const kUtterances = "utterances";

export const kFootnoteSectionTitle = "footnote-section-title";

export const kDocumentCss = "document-css";
export const kBootstrapDependencyName = "bootstrap";

export const quartoRules = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-rules.scss",
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

export const quartoFunctions = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-functions.scss",
  ));

export const quartoDefaults = (format: Format) => {
  const defaults: string[] = [];
  defaults.push(
    print(
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
    print(
      sassVariable(
        "code-white-space",
        format.render[kCodeOverflow] === "wrap" ? "pre-wrap" : "pre",
      ),
    ),
  );
  return defaults.join("\n");
};
