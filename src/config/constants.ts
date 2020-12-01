/*
* constants.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export const kMetadataFormat = "format";

export const kRenderDefaults = "render";
export const kExecutionDefaults = "execution";
export const kPandocDefaults = "pandoc";
export const kPandocMetadata = "metadata";

export const kFigWidth = "fig-width";
export const kFigHeight = "fig-height";
export const kFigFormat = "fig-format";
export const kFigDpi = "fig-dpi";

export const kHideCell = "hide-cell";
export const kHideCode = "hide-code";
export const kHideOutput = "hide-output";
export const kIncludeCode = "include-code";
export const kIncludeOutput = "include-output";
export const kIncludeWarnings = "include-warnings";
export const kExecute = "execute";
export const kCache = "cache";
export const kAllowErrors = "allow-errors";

export const kHideWarnings = "hide-warnings";
export const kRemoveCell = "remove-cell";
export const kRemoveCode = "remove-code";
export const kRemoveOutput = "remove-output";
export const kRemoveWarnings = "remove-warnings";

export const kKeepHidden = "keep-hidden";
export const kShowCode = "show-code";
export const kShowOutput = "show-output";
export const kShowWarnings = "show-warnings";

export const kExecutionDefaultsKeys = [
  kFigWidth,
  kFigHeight,
  kFigFormat,
  kFigDpi,
  kIncludeCode,
  kIncludeOutput,
  kIncludeWarnings,
  kAllowErrors,
  kExecute,
  kCache,
  kKeepHidden,
  kShowCode,
  kShowOutput,
  kShowWarnings,
];

export const kKeepMd = "keep-md";
export const kKeepTex = "keep-tex";
export const kKeepYaml = "keep-yaml";
export const kKeepSource = "keep-source";
export const kVariant = "variant";
export const kOutputExt = "output-ext";
export const kPreferHtml = "prefer-html";

export const kRenderDefaultsKeys = [
  kKeepMd,
  kKeepTex,
  kKeepYaml,
  kKeepSource,
  kVariant,
  kOutputExt,
  kPreferHtml,
];

// 'defaults' fields
export const kTo = "to";
export const kFrom = "from";
export const kReader = "reader";
export const kWriter = "writer";
export const kOutputFile = "output-file";
export const kAtxHeaders = "atx-headers";
export const kMarkdownHeadings = "markdown-headings";
export const kTemplate = "template";
export const kStandalone = "standalone";
export const kSelfContained = "self-contained";
export const kIncludeBeforeBody = "include-before-body";
export const kIncludeAfterBody = "include-after-body";
export const kIncludeInHeader = "include-in-header";
export const kCiteproc = "citeproc";
export const kCiteMethod = "cite-method";
export const kFilters = "filters";
export const kPdfEngine = "pdf-engine";
export const kPdfEngineOpts = "pdf-engine-opts";
export const kPdfEngineOpt = "pdf-engine-opt";
export const kListings = "listings";
export const kNumberSections = "number-sections";
export const kNumberOffset = "number-offset";
export const kTopLevelDivision = "top-level-division";

// metadata fields
export const kBibliography = "bibliography";

// https://pandoc.org/MANUAL.html#default-files
// note: we are keeping some things out of 'defaults' b/ca
// they are known to be valid in metadata. this includes:
//    "csl",
//    "bibliography",
//
export const kPandocDefaultsKeys = [
  kTo,
  kFrom,
  kReader,
  kWriter,
  kOutputFile,
  "input-files",
  kTemplate,
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
  kCiteproc,
  kCiteMethod,
  "filters",
  "file-scope",
  "data-dir",
  "verbosity",
  "log-file",
  kTopLevelDivision,
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
  kNumberSections,
  kNumberOffset,
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
  kListings,
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
  kMarkdownHeadings,
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
