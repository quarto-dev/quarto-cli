/*
* constants.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

export const kMetadataFormat = "format";

export const kRenderDefaults = "render";
export const kComputeDefaults = "compute";
export const kPandocDefaults = "pandoc";
export const kPandocMetadata = "metadata";

export const kFigWidth = "fig-width";
export const kFigHeight = "fig-height";
export const kFigFormat = "fig-format";
export const kShowCode = "show-code";
export const kShowWarning = "show-warning";

export const kComputeDefaultsKeys = [
  kFigWidth,
  kFigHeight,
  kFigFormat,
  kShowCode,
  kShowWarning,
];

export const kKeepMd = "keep-md";
export const kKeepTex = "keep-tex";
export const kKeepYaml = "keep-yaml";
export const kVariant = "variant";
export const kOutputExt = "output-ext";

export const kRenderDefaultsKeys = [
  kKeepMd,
  kKeepTex,
  kKeepYaml,
  kVariant,
  kOutputExt,
];

export const kAtxHeaders = "atx-headers";
export const kStandalone = "standalone";
export const kSelfContained = "self-contained";
export const kIncludeBeforeBody = "include-before-body";
export const kIncludeAfterBody = "include-after-body";
export const kIncludeInHeader = "include-in-header";
export const kCiteMethod = "cite-method";
export const kPdfEngine = "pdf-engine";
export const kPdfEngineOpts = "pdf-engine-opts";
export const kPdfEngineOpt = "pdf-engine-opt";

// https://pandoc.org/MANUAL.html#default-files
export const kPandocDefaultsKeys = [
  "to",
  "from",
  "reader",
  "writer",
  "output-file",
  "input-files",
  "template",
  kStandalone,
  kSelfContained,
  "variables",
  "metadata",
  "metadata-files",
  "metadata-file",
  kIncludeBeforeBody,
  kIncludeAfterBody,
  kIncludeInHeader,
  "resource-path",
  "citeproc",
  "csl",
  "bibliography",
  "filters",
  "file-scope",
  "data-dir",
  "verbosity",
  "log-file",
  kCiteMethod,
  "top-level-division",
  "abbreviations",
  kPdfEngine,
  kPdfEngineOpts,
  kPdfEngineOpt,
  "wrap",
  "columns",
  "dpi",
  "extract-media",
  "toc",
  "table-of-contents",
  "toc-depth",
  "number-sections",
  "number-offset",
  "shift-heading-level-by",
  "section-divs",
  "identifier-prefix",
  "title-prefix",
  "strip-empty-paragraphs",
  "eol",
  "strip-comments",
  "indented-code-classes",
  "ascii",
  "default-image-extension",
  "highlight-style",
  "syntax-definitions",
  "syntax-definition",
  "listings",
  "reference-doc",
  "html-math-method",
  "email-obfuscation",
  "tab-stop",
  "preserve-tabs",
  "incremental",
  "slide-level",
  "epub-subdirectory",
  "epub-metadata",
  "epub-fonts",
  "epub-chapter-level",
  "epub-cover-image",
  "reference-links",
  "reference-location",
  kAtxHeaders,
  "track-changes",
  "html-q-tags",
  "css",
  "ipynb-output",
  "request-headers",
  "fail-if-warnings",
  "dump-args",
  "ignore-args",
  "trace",
];
