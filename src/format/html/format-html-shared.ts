/*
 * format-html-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
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
import { normalizePath } from "../../core/path.ts";

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
export const kXrefsHover = "crossrefs-hover";
export const kSmoothScroll = "smooth-scroll";

// Code Annotation
export const kCodeAnnotations = "code-annotations";

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
export const kAppendixCiteAs = "appendix-cite-as";
export const kLicense = "license";
export const kCopyright = "copyright";

export const kCitation = "citation";

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

export const quartoCopyCodeDefaults = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-variables-copy-code.scss",
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

export const quartoCodeFilenameRules = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-rules-code-filename.scss",
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
  codeFilename = false,
) => {
  const rules: string[] = [quartoRules()];
  const defaults: string[] = [quartoDefaults(format), quartoVariables()];
  if (codeCopy) {
    rules.push(quartoCopyCodeRules());
    defaults.push(quartoCopyCodeDefaults());
  }
  if (tabby) {
    rules.push(quartoTabbyRules());
  }
  if (figResponsive) {
    rules.push(quartoFigResponsiveRules());
  }
  if (codeFilename) {
    rules.push(quartoCodeFilenameRules());
  }
  if (format.render[kLinkExternalIcon]) {
    rules.push(quartoLinkExternalRules());
  }

  return {
    uses: quartoUses(),
    defaults: defaults.join("\n"),
    functions: quartoFunctions(),
    mixins: "",
    rules: rules.join("\n"),
  };
};

export const quartoVariables = () =>
  Deno.readTextFileSync(formatResourcePath(
    "html",
    "_quarto-variables.scss",
  ));

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
    (backlink as Element).remove();
  }
}

export function setMainColumn(doc: Document, column: string) {
  const selectors = [
    "main.content",
    ".page-navigation",
    ".quarto-title-banner .quarto-title",
    ".quarto-title-block .quarto-title-meta-author",
    ".quarto-title-block .quarto-title-meta",
    "div[class^='quarto-about-']",
    "div[class*=' quarto-about-']",
  ];
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
  const rootDir = normalizePath(join(dirname(input), offset));
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

export function writeMetaTag(name: string, content: string, doc: Document) {
  // Meta tag
  const m = doc.createElement("META");
  if (name.startsWith("og:")) {
    m.setAttribute("property", name);
  } else {
    m.setAttribute("name", name);
  }
  m.setAttribute("content", content);

  // New Line
  const nl = doc.createTextNode("\n");

  // Insert the nodes
  doc.querySelector("head")?.appendChild(m);
  doc.querySelector("head")?.appendChild(nl);
}

export function formatPageLayout(format: Format) {
  return format.metadata[kPageLayout] as string || kPageLayoutArticle;
}

export function formatHasFullLayout(format: Format) {
  return format.metadata[kPageLayout] === kPageLayoutFull;
}

export function formatHasArticleLayout(format: Format) {
  return format.metadata[kPageLayout] === undefined ||
    format.metadata[kPageLayout] === kPageLayoutArticle ||
    format.metadata[kPageLayout] === kPageLayoutFull;
}
