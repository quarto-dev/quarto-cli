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
export const kFreeze = "freeze";
export const kAllowErrors = "allow-errors";
export const kResources = "resources";

export const kHideWarnings = "hide-warnings";
export const kRemoveCell = "remove-cell";
export const kRemoveCode = "remove-code";
export const kRemoveOutput = "remove-output";
export const kRemoveWarnings = "remove-warnings";

export const kKeepHidden = "keep-hidden";
export const kShowCode = "show-code";
export const kShowOutput = "show-output";
export const kShowWarnings = "show-warnings";

export const kKernelKeepalive = "kernel-keepalive";
export const kKernelRestart = "kernel-restart";
export const kKernelDebug = "kernel-debug";

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
  kFreeze,
  kKeepHidden,
  kShowCode,
  kShowOutput,
  kShowWarnings,
  kKernelKeepalive,
  kKernelRestart,
  kKernelDebug,
];

export const kKeepMd = "keep-md";
export const kKeepTex = "keep-tex";
export const kKeepYaml = "keep-yaml";
export const kKeepIpynb = "keep-ipynb";
export const kKeepSource = "keep-source";
export const kVariant = "variant";
export const kOutputExt = "output-ext";
export const kOutputDivs = "output-divs";
export const kPageWidth = "page-width";
export const kFigAlign = "fig-align";
export const kCodeFold = "code-fold";
export const kCodeSummary = "code-summary";
export const kCodeLink = "code-link";
export const kMergeIncludes = "merge-includes";
export const kPreferHtml = "prefer-html";

export const kLatexAutoMk = "latex-auto-mk";
export const kLatexAutoInstall = "latex-auto-install";
export const kLatexMinRuns = "latex-min-runs";
export const kLatexMaxRuns = "latex-max-runs";
export const kLatexClean = "latex-clean";

export const kLatexMakeIndex = "latex-makeindex";
export const kLatexMakeIndexOpts = "latex-makeindex-opts";

export const kLatexTlmgrOpts = "latex-tlmgr-opts";
export const kLatexOutputDir = "latex-output-dir";

export const kRenderDefaultsKeys = [
  kKeepMd,
  kKeepTex,
  kKeepYaml,
  kKeepIpynb,
  kKeepSource,
  kVariant,
  kOutputExt,
  kOutputDivs,
  kPreferHtml,
  kPageWidth,
  kFigAlign,
  kCodeFold,
  kCodeLink,
  kCodeSummary,
  kLatexAutoMk,
  kLatexAutoInstall,
  kLatexMinRuns,
  kLatexMaxRuns,
  kLatexClean,
  kLatexMakeIndex,
  kLatexMakeIndexOpts,
  kLatexTlmgrOpts,
  kLatexOutputDir,
];

// 'defaults' fields
export const kTo = "to";
export const kFrom = "from";
export const kReader = "reader";
export const kWriter = "writer";
export const kOutputFile = "output-file";
export const kInputFiles = "input-files";
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
export const kFilterParams = "filter-params";
export const kPdfEngine = "pdf-engine";
export const kPdfEngineOpts = "pdf-engine-opts";
export const kPdfEngineOpt = "pdf-engine-opt";
export const kListings = "listings";
export const kNumberSections = "number-sections";
export const kNumberOffset = "number-offset";
export const kNumberDepth = "number-depth";
export const kTopLevelDivision = "top-level-division";
export const kLogFile = "log-file";
export const kHighlightStyle = "highlight-style";
export const kVariables = "variables";
export const kMetadataFile = "metadata-file";
export const kMetadataFiles = "metadata-files";
export const kSyntaxDefinitions = "syntax-definitions";
export const kSyntaxDefinition = "syntax-definition";
export const kReferenceDoc = "reference-doc";
export const kHtmlMathMethod = "html-math-method";
export const kToc = "toc";
export const kTableOfContents = "table-of-contents";
export const kSectionDivs = "section-divs";

// metadata fields
export const kTitle = "title";
export const kSubtitle = "subtitle";
export const kAuthor = "author";
export const kDate = "date";
export const kDoi = "doi";
export const kAbstract = "abstract";
export const kDescription = "description";

export const kPageTitle = "pagetitle";
export const kTitlePrefix = "title-prefix";
export const kCsl = "csl";
export const kCss = "css";
export const kBibliography = "bibliography";
export const kHeaderIncludes = "header-includes";
export const kIncludeBefore = "include-before";
export const kIncludeAfter = "include-after";
export const kTocTitle = "toc-title";
export const kLinkCitations = "link-citations";
export const kDocumentClass = "documentclass";

export const kTheme = "theme";
export const kCrossref = "crossref";
export const kCrossrefChapters = "chapters";
export const kCrossrefLabels = "labels";
export const kCrossrefAppendixTitle = "appendix-title";
export const kCrossrefAppendixDelim = "appendix-delim";
export const kCrossrefChaptersAlpha = "chapters-alpha";
export const kCrossrefChapterId = "chapter-id";

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
  kInputFiles,
  kTemplate,
  kStandalone,
  kSelfContained,
  kVariables,
  "metadata",
  kMetadataFiles,
  kMetadataFile,
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
  kLogFile,
  kTopLevelDivision,
  "abbreviations",
  kPdfEngine,
  kPdfEngineOpts,
  kPdfEngineOpt,
  "wrap",
  "columns",
  "dpi",
  "extract-media",
  kToc,
  kTableOfContents,
  "toc-depth",
  kNumberSections,
  kNumberOffset,
  "shift-heading-level-by",
  kSectionDivs,
  "identifier-prefix",
  kTitlePrefix,
  "strip-empty-paragraphs",
  "eol",
  "strip-comments",
  "indented-code-classes",
  "ascii",
  "default-image-extension",
  kHighlightStyle,
  kSyntaxDefinitions,
  kSyntaxDefinition,
  kListings,
  kReferenceDoc,
  kHtmlMathMethod,
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
