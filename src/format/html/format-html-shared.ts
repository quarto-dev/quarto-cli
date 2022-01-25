/*
* format-html-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { outputVariable, sassLayer, sassVariable } from "../../core/sass.ts";
import {
  kCapLoc,
  kCapTop,
  kCodeOverflow,
  kLinkExternalIcon,
  kSectionTitleFootnotes,
  kTblCapLoc,
} from "../../config/constants.ts";
import {
  Format,
  FormatDependency,
  FormatLanguage,
} from "../../config/types.ts";

import { formatResourcePath } from "../../core/resources.ts";
import { Document, Element } from "../../core/deno-dom.ts";

// features that are enabled by default for 'html'. setting
// all of these to false will yield the minimal html output
// that quarto can produce (there is still some CSS we generate
// to provide figure layout, etc.). you can also set the
// 'minimal' option to do this in one shot
export const kTabsets = "tabsets";
export const kCodeCopy = "code-copy";
export const kAnchorSections = "anchor-sections";
export const kCitationsHover = "citations-hover";
export const kFootnotesHover = "footnotes-hover";

// turn off optional html features as well as all themes
export const kMinimal = "minimal";

export const kPageLayout = "page-layout";
export const kPageLayoutArticle = "article";
export const kPageLayoutCustom = "custom";
export const kPageLayoutNone = "none";
export const kPageLayoutFull = "full";
export const kComments = "comments";
export const kHypothesis = "hypothesis";
export const kUtterances = "utterances";

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

export const bootstrapFunctions = () => {
  return Deno.readTextFileSync(
    join(bootstrapResourceDir(), "_functions.scss"),
  );
};

export const bootstrapMixins = () => {
  return Deno.readTextFileSync(
    join(bootstrapResourceDir(), "_mixins.scss"),
  );
};

export const bootstrapVariables = () => {
  return Deno.readTextFileSync(
    join(bootstrapResourceDir(), "_variables.scss"),
  );
};

export const bootstrapRules = () => {
  return Deno.readTextFileSync(
    join(bootstrapResourceDir(), "bootstrap.scss"),
  );
};

export const bootstrapResourceDir = () => {
  return formatResourcePath(
    "html",
    join("bootstrap", "dist", "scss"),
  );
};

export const sassUtilFunctions = (name: string) => {
  const bootstrapDistDir = formatResourcePath(
    "html",
    join("bootstrap", "dist"),
  );

  const path = join(bootstrapDistDir, "sass-utils", name);
  return Deno.readTextFileSync(path);
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

export const quartoTabbyRules = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-rules-tabby.scss",
  ));

export const quartoFigResponsiveRules = () => {
  return [
    ".img-fluid {",
    "  max-width: 100%;",
    "  height: auto;",
    "}",
  ].join("\n");
};

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
export const quartoBootstrapCustomizationLayer = () => {
  const path = formatResourcePath(
    "html",
    join("bootstrap", "_bootstrap-customize.scss"),
  );
  return sassLayer(path);
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

export const quartoBaseLayer = (
  format: Format,
  codeCopy = false,
  tabby = false,
  figResponsive = false,
) => {
  const rules: string[] = [quartoRules()];
  if (codeCopy) {
    rules.push(quartoCopyCodeRules());
  }
  if (tabby) {
    rules.push(quartoTabbyRules());
  }
  if (figResponsive) {
    rules.push(quartoFigResponsiveRules());
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
  defaults.push(
    outputVariable(
      sassVariable(
        kTblCapLoc,
        format.metadata[kTblCapLoc] ||
          format.metadata[kCapLoc] || kCapTop,
      ),
    ),
  );
  return defaults.join("\n");
};

export function insertFootnotesTitle(
  doc: Document,
  footnotesEl: Element,
  language: FormatLanguage,
  level = 2,
) {
  const heading = doc.createElement("h" + level);
  const title = language[kSectionTitleFootnotes];
  if (typeof (title) == "string" && title !== "none") {
    heading.innerHTML = title;
  }
  footnotesEl.insertBefore(heading, footnotesEl.firstChild);
  const hr = footnotesEl.querySelector("hr");
  if (hr) {
    hr.remove();
  }
}

export function removeFootnoteBacklinks(footnotesEl: Element) {
  const backlinks = footnotesEl.querySelectorAll(".footnote-back");
  for (const backlink of backlinks) {
    backlink.remove();
  }
}
