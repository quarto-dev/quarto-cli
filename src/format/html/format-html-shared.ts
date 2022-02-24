/*
* format-html-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join, relative } from "path/mod.ts";
import { outputVariable, sassLayer, sassVariable } from "../../core/sass.ts";
import {
  kCapLoc,
  kCapTop,
  kCitationLocation,
  kCodeOverflow,
  kCopyButtonTooltip,
  kLinkExternalIcon,
  kReferenceLocation,
  kSectionTitleFootnotes,
  kSectionTitleReferences,
  kTblCapLoc,
} from "../../config/constants.ts";
import {
  Format,
  FormatDependency,
  FormatLanguage,
  PandocFlags,
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
export const kPageLayoutFull = "full";
export const kComments = "comments";
export const kHypothesis = "hypothesis";
export const kUtterances = "utterances";
export const kGiscus = "giscus";

export const kGiscusRepoId = "repo-id";
export const kGiscusCategoryId = "category-id";

export const kDraft = "draft";

export const kAppendixStyle = "appendix-style";
export const kLicense = "license";

export const kCitationUrl = "citation-url";
export const kCitation = "citation";
export const kPublicationDate = "publication-date";
export const kPublicationType = "publication-type";
export const kPublicationTitle = "publication-title";
export const kPublicationVolume = "publication-volume";
export const kPublicationIssue = "publication-issue";
export const kPublicationISSN = "publiction-issn";
export const kPublicationISBN = "publication-isbn";
export const kPublicationFirstPage = "publication-firstpage";
export const kPublicationLastPage = "publication-lastpage";
export const kPublicationInstitution = "publication-institution";
export const kPublicationReportNumber = "publication-report-number";

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
    uses: quartoUses(),
    defaults: [
      quartoDefaults(format),
    ].join("\n"),
    functions: quartoFunctions(),
    mixins: "",
    rules: rules.join("\n"),
  };
};

export const quartoUses = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-uses.scss",
  ));

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
  classes: string[] = [],
) {
  prependHeading(
    doc,
    footnotesEl,
    language[kSectionTitleFootnotes],
    level,
    classes,
  );
}

export function insertReferencesTitle(
  doc: Document,
  refsEl: Element,
  language: FormatLanguage,
  level = 2,
  classes: string[] = [],
) {
  prependHeading(
    doc,
    refsEl,
    language[kSectionTitleReferences],
    level,
    classes,
  );
}

export function insertTitle(
  doc: Document,
  el: Element,
  title: string,
  level = 2,
  headingClasses: string[] = [],
) {
  prependHeading(doc, el, title, level, headingClasses);
}

function prependHeading(
  doc: Document,
  el: Element,
  title: string | undefined,
  level: number,
  classes: string[],
) {
  const heading = doc.createElement("h" + level);
  if (typeof (title) == "string" && title !== "none") {
    heading.innerHTML = title;
  }
  if (classes) {
    classes.forEach((clz) => {
      heading.classList.add(clz);
    });
  }

  el.insertBefore(heading, el.firstChild);
  const hr = el.querySelector("hr");
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

export function setMainColumn(doc: Document, column: string) {
  const selectors = ["main.content", ".page-navigation"];
  selectors.forEach((selector) => {
    const el = doc.querySelector(selector);
    if (el) {
      // Clear existing column
      for (const clz of el.classList) {
        if (clz.startsWith("column-")) {
          el.classList.remove(clz);
        }
      }

      // Set the new column
      el.classList.add(column);
    }
  });
}

export function hasMarginRefs(format: Format, flags: PandocFlags) {
  // If margin footnotes are enabled move them
  return format.pandoc[kReferenceLocation] === "margin" ||
    flags[kReferenceLocation] === "margin";
}

export function hasMarginCites(format: Format) {
  // If margin cites are enabled, move them
  return format.metadata[kCitationLocation] === "margin";
}

export function computeUrl(
  input: string,
  baseUrl: string,
  offset: string,
  outputFileName: string,
) {
  const rootDir = Deno.realPathSync(join(dirname(input), offset));
  if (outputFileName === "index.html") {
    return `${baseUrl}/${relative(rootDir, dirname(input))}`;
  } else {
    return `${baseUrl}/${
      relative(rootDir, join(dirname(input), outputFileName))
    }`;
  }
}

export function createCodeCopyButton(doc: Document, format: Format) {
  const copyButton = doc.createElement("button");
  const title = format.language[kCopyButtonTooltip]!;
  copyButton.setAttribute("title", title);
  copyButton.classList
    .add("code-copy-button");
  const copyIcon = doc.createElement("i");
  copyIcon.classList.add("bi");
  copyButton.appendChild(copyIcon);
  return copyButton;
}

export function createCodeBlock(
  doc: Document,
  htmlContents: string,
  language?: string,
) {
  const preEl = doc.createElement("PRE");
  preEl.classList.add("sourceCode");
  preEl.classList.add("code-with-copy");

  const codeEl = doc.createElement("CODE");
  codeEl.classList.add("sourceCode");
  if (language) {
    codeEl.classList.add(language);
  }
  codeEl.innerHTML = htmlContents;
  preEl.appendChild(codeEl);
  return preEl;
}
