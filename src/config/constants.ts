/*
 * constants.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

export const kMetadataFormat = "format";

export const kDisplayName = "display-name";
export const kExtensionName = "extension-name";
export const kTargetFormat = "target-format";
export const kBaseFormat = "base-format";
export const kIdentifierDefaults = "indentifier";
export const kRenderDefaults = "render";
export const kExecuteDefaults = "execute";
export const kPandocDefaults = "pandoc";
export const kLanguageDefaults = "language";
export const kPandocMetadata = "metadata";

export const kFigWidth = "fig-width";
export const kFigHeight = "fig-height";
export const kFigFormat = "fig-format";
export const kFigDpi = "fig-dpi";

export const kMermaidFormat = "mermaid-format";
export const kDfPrint = "df-print";

export const kCache = "cache";
export const kFreeze = "freeze";
export const kEngine = "engine";
export const kEval = "eval";
export const kEcho = "echo";
export const kOutput = "output";
export const kWarning = "warning";
export const kError = "error";
export const kInclude = "include";

export const kResources = "resources";
export const kFormatResources = "format-resources";
export const kSupporting = "supporting";

export const kIpynbProduceSourceNotebook = "produce-source-notebook";
export const kEnableCrossRef = "enable-crossref";

export const kFormatLinks = "format-links";
export const kNotebookLinks = "notebook-links";
export const kOtherLinks = "other-links";
export const kNotebookSubarticles = "notebook-subarticles";
export const kNotebookView = "notebook-view";
export const kNotebookViewStyle = "notebook-view-style";
export const kNotebookPreserveCells = "notebook-preserve-cells";
export const kClearCellOptions = "clear-cell-options";
export const kDownloadUrl = "download-url";

export const kNotebookPreviewOptions = "notebook-preview-options";
export const kNotebookPreviewOptionBack = "back";

export const kKeepHidden = "keep-hidden";
export const kRemoveHidden = "remove-hidden";
export const kClearHiddenClasses = "clear-hidden-classes";

export const kUnrollMarkdownCells = "unroll-markdown-cells";

export const kExecuteEnabled = "enabled";
export const kExecuteIpynb = "ipynb";
export const kExecuteDaemon = "daemon";
export const kExecuteDaemonRestart = "daemon-restart";
export const kExecuteDebug = "debug";

export const kIpynbFilter = "ipynb-filter";
export const kIpynbFilters = "ipynb-filters";
export const kIPynbTitleBlockTemplate = "ipynb-title-block";

export const kJatsSubarticleId = "jats-subarticle-id";

export const kShortcodes = "shortcodes";

export const kKeepMd = "keep-md";
export const kKeepTex = "keep-tex";
export const kKeepTyp = "keep-typ";
export const kKeepIpynb = "keep-ipynb";
export const kKeepSource = "keep-source";
export const kVariant = "variant";
export const kOutputExt = "output-ext";
export const kOutputDivs = "output-divs";
export const kPageWidth = "page-width";
export const kFigAlign = "fig-align";
export const kFigEnv = "fig-env";
export const kFigPos = "fig-pos";
export const kCodeFold = "code-fold";
export const kCodeLineNumbers = "code-line-numbers";
export const kCodeOverflow = "code-overflow";
export const kCodeLink = "code-link";
export const kCodeTools = "code-tools";
export const kTblCap = "tbl-cap";
export const kTblColwidths = "tbl-colwidths";
export const kMergeIncludes = "merge-includes";
export const kInlineIncludes = "inline-includes";
export const kPreserveYaml = "preserve-yaml";
export const kPreferHtml = "prefer-html";
export const kSelfContainedMath = "self-contained-math";
export const kBiblioConfig = "biblio-config";

export const kLatexAutoMk = "latex-auto-mk";
export const kLatexAutoInstall = "latex-auto-install";
export const kLatexMinRuns = "latex-min-runs";
export const kLatexMaxRuns = "latex-max-runs";
export const kLatexClean = "latex-clean";
export const kLatexInputPaths = "latex-input-paths";
export const kLatexMakeIndex = "latex-makeindex";
export const kLatexMakeIndexOpts = "latex-makeindex-opts";
export const kLatexTinyTex = "latex-tinytex";

export const kLatexTlmgrOpts = "latex-tlmgr-opts";
export const kLatexOutputDir = "latex-output-dir";

export const kLinkExternalIcon = "link-external-icon";
export const kLinkExternalNewwindow = "link-external-newwindow";
export const kLinkExternalFilter = "link-external-filter";

export const kQuartoVersion = "quarto-version";
export const kQuartoRequired = "quarto-required";

export const kPreviewMode = "preview-mode";
export const kPreviewModeRaw = "raw";

export const kIdentifierDefaultsKeys = [
  kTargetFormat,
  kDisplayName,
  kExtensionName,
];

export const kExecuteDefaultsKeys = [
  kFigWidth,
  kFigHeight,
  kFigFormat,
  kFigDpi,
  kMermaidFormat,
  kDfPrint,
  kError,
  kEval,
  kEngine,
  kCache,
  kFreeze,
  kEcho,
  kOutput,
  kWarning,
  kInclude,
  kKeepMd,
  kKeepIpynb,
  kExecuteEnabled,
  kExecuteIpynb,
  kExecuteDaemon,
  kExecuteDaemonRestart,
  kExecuteDebug,
  kIpynbFilter,
  kIpynbFilters,
];

export const kRenderDefaultsKeys = [
  kKeepTex,
  kKeepTyp,
  kKeepSource,
  kKeepHidden,
  kRemoveHidden,
  kClearHiddenClasses,
  kVariant,
  kOutputExt,
  kOutputDivs,
  kPreferHtml,
  kPageWidth,
  kFigAlign,
  kFigPos,
  kFigEnv,
  kCodeFold,
  kCodeLink,
  kCodeLineNumbers,
  kCodeOverflow,
  kCodeTools,
  kShortcodes,
  kTblColwidths,
  kInlineIncludes,
  kPreserveYaml,
  kMergeIncludes,
  kSelfContainedMath,
  kLatexAutoMk,
  kLatexAutoInstall,
  kLatexMinRuns,
  kLatexMaxRuns,
  kLatexClean,
  kLatexInputPaths,
  kLatexMakeIndex,
  kLatexMakeIndexOpts,
  kLatexTlmgrOpts,
  kLatexOutputDir,
  kLatexTinyTex,
  kLinkExternalIcon,
  kLinkExternalNewwindow,
  kLinkExternalFilter,
  kFormatResources,
  kFormatLinks,
  kIpynbProduceSourceNotebook,
  kNotebookLinks,
  kNotebookSubarticles,
  kNotebookView,
  kNotebookViewStyle,
  kNotebookPreserveCells,
  kClearCellOptions,
];

// language fields
export const kTocTitleDocument = "toc-title-document";
export const kTocTitleWebsite = "toc-title-website";
export const kRelatedFormatsTitle = "related-formats-title";
export const kRelatedNotebooksTitle = "related-notebooks-title";
export const kOtherLinksTitle = "other-links-title";
export const kSourceNotebookPrefix = "source-notebooks-prefix";
export const kCalloutTipCaption = "callout-tip-title";
export const kCalloutNoteCaption = "callout-note-title";
export const kCalloutWarningCaption = "callout-warning-title";
export const kCalloutImportantCaption = "callout-important-title";
export const kCalloutCautionCaption = "callout-caution-title";
export const kSectionTitleAbstract = "section-title-abstract";
export const kSectionTitleFootnotes = "section-title-footnotes";
export const kSectionTitleReferences = "section-title-references";
export const kSectionTitleAppendices = "section-title-appendices";
export const kSectionTitleReuse = "section-title-reuse";
export const kSectionTitleCopyright = "section-title-copyright";
export const kSectionTitleCitation = "section-title-citation";
export const kAppendixAttributionBibTex = "appendix-attribution-bibtex";
export const kAppendixAttributionCiteAs = "appendix-attribution-cite-as";
export const kTitleBlockAuthorSingle = "title-block-author-single";
export const kTitleBlockAuthorPlural = "title-block-author-plural";
export const kTitleBlockAffiliationSingle = "title-block-affiliation-single";
export const kTitleBlockAffiliationPlural = "title-block-affiliation-plural";
export const kTitleBlockPublished = "title-block-published";
export const kTitleBlockModified = "title-block-modified";
export const kCodeSummary = "code-summary";
export const kCodeLine = "code-line";
export const kCodeLines = "code-lines";
export const kCodeToolsMenuCaption = "code-tools-menu-caption";
export const kCodeToolsShowAllCode = "code-tools-show-all-code";
export const kCodeToolsHideAllCode = "code-tools-hide-all-code";
export const kCodeToolsViewSource = "code-tools-view-source";
export const kCodeToolsSourceCode = "code-tools-source-code";
export const kSearchNoResultsText = "search-no-results-text";
export const kSearchLabel = "search-label";

export const kToggleSection = "toggle-section";
export const kToggleSidebar = "toggle-sidebar";
export const kToggleDarkMode = "toggle-dark-mode";
export const kToggleReaderMode = "toggle-reader-mode";
export const kToggleNavigation = "toggle-navigation";

export const kCopyButtonTooltip = "copy-button-tooltip";
export const kCopyButtonTooltipSuccess = "copy-button-tooltip-success";
export const kBackToTop = "back-to-top";
export const kRepoActionLinksEdit = "repo-action-links-edit";
export const kRepoActionLinksSource = "repo-action-links-source";
export const kRepoActionLinksIssue = "repo-action-links-issue";
export const kSearchMatchingDocumentsText = "search-matching-documents-text";
export const kSearchCopyLinkTitle = "search-copy-link-title";
export const kSearchHideMatchesText = "search-hide-matches-text";
export const kSearchMoreMatchText = "search-more-match-text";
export const kSearchMoreMatchesText = "search-more-matches-text";
export const kSearchClearButtonTitle = "search-clear-button-title";
export const kSearchDetatchedCancelButtonTitle =
  "search-detached-cancel-button-title";
export const kSearchSubmitButtonTitle = "search-submit-button-title";
export const kCrossrefFigTitle = "crossref-fig-title";
export const kCrossrefTblTitle = "crossref-tbl-title";
export const kCrossrefLstTitle = "crossref-lst-title";
export const kCrossrefThmTitle = "crossref-thm-title";
export const kCrossrefLemTitle = "crossref-lem-title";
export const kCrossrefCorTitle = "crossref-cor-title";
export const kCrossrefPrfTitle = "crossref-prp-title";
export const kCrossrefCnjTitle = "crossref-cnj-title";
export const kCrossrefDefTitle = "crossref-def-title";
export const kCrossrefExmTitle = "crossref-exm-title";
export const kCrossrefExrTitle = "crossref-exr-title";
export const kCrossrefFigPrefix = "crossref-fig-prefix";
export const kCrossrefTblPrefix = "crossref-tbl-prefix";
export const kCrossrefLstPrefix = "crossref-lst-prefix";
export const kCrossrefChPrefix = "crossref-ch-prefix";
export const kCrossrefApxPrefix = "crossref-apx-prefix";
export const kCrossrefSecPrefix = "crossref-sec-prefix";
export const kCrossrefEqPrefix = "crossref-eq-prefix";
export const kCrossrefThmPrefix = "crossref-thm-prefix";
export const kCrossrefLemPrefix = "crossref-lem-prefix";
export const kCrossrefCorPrefix = "crossref-cor-prefix";
export const kCrossrefPrpPrefix = "crossref-prp-prefix";
export const kCrossrefCnjPrefix = "crossref-cnj-prefix";
export const kCrossrefDefPrefix = "crossref-def-prefix";
export const kCrossrefExmPrefix = "crossref-exm-prefix";
export const kCrossrefExrPrefix = "crossref-exr-prefix";
export const kCrossrefLofTitle = "crossref-lof-title";
export const kCrossrefLotTitle = "crossref-lot-title";
export const kCrossrefLolTitle = "crossref-lol-title";
export const kEnvironmentProofTitle = "environment-proof-title";
export const kEnvironmentRemarkTitle = "environment-remark-title";
export const kEnvironmentSolutionTitle = "environment-solution-title";
export const kListingPageOrderBy = "listing-page-order-by";
export const kListingPageOrderByDefault = "listing-page-order-by-default";
export const kListingPageOrderByDateAsc = "listing-page-order-by-date-asc";
export const kListingPageOrderByDateDesc = "listing-page-order-by-date-desc";
export const kListingPageOrderByNumberAsc = "listing-page-order-by-number-asc";
export const kListingPageOrderByNumberDesc =
  "listing-page-order-by-number-desc";
export const kListingPageFieldDate = "listing-page-field-date";
export const kListingPageFieldTitle = "listing-page-field-title";
export const kListingPageFieldDescription = "listing-page-field-description";
export const kListingPageFieldAuthor = "listing-page-field-author";
export const kListingPageFieldFileName = "listing-page-field-filename";
export const kListingPageFieldFileModified = "listing-page-field-filemodified";
export const kListingPageFieldSubtitle = "listing-page-field-subtitle";
export const kListingPageFieldReadingTime = "listing-page-field-readingtime";
export const kListingPageFieldCategories = "listing-page-field-categories";
export const kListingPageMinutesCompact = "listing-page-minutes-compact";
export const kListingPageCategoryAll = "listing-page-category-all";
export const kListingPageNoMatches = "listing-page-no-matches";
export const kNotebookPreviewDownload = "notebook-preview-download";
export const kNotebookPreviewDownloadSrc = "notebook-preview-download-src";
export const kNotebookPreviewBack = "notebook-preview-back";
export const kArticleNotebookLabel = "article-notebook-label";
export const kManuscriptMecaBundle = "manuscript-meca-bundle";

export const kLanguageDefaultsKeys = [
  kTocTitleDocument,
  kTocTitleWebsite,
  kRelatedFormatsTitle,
  kOtherLinksTitle,
  kRelatedNotebooksTitle,
  kSourceNotebookPrefix,
  kCalloutTipCaption,
  kCalloutNoteCaption,
  kCalloutWarningCaption,
  kCalloutImportantCaption,
  kCalloutCautionCaption,
  kSectionTitleAbstract,
  kSectionTitleFootnotes,
  kSectionTitleReferences,
  kSectionTitleAppendices,
  kSectionTitleReuse,
  kSectionTitleCopyright,
  kSectionTitleCitation,
  kAppendixAttributionBibTex,
  kAppendixAttributionCiteAs,
  kTitleBlockAuthorSingle,
  kTitleBlockPublished,
  kTitleBlockModified,
  kCodeSummary,
  kCodeLine,
  kCodeLines,
  kCodeToolsMenuCaption,
  kCodeToolsShowAllCode,
  kCodeToolsHideAllCode,
  kCodeToolsViewSource,
  kCodeToolsSourceCode,
  kSearchNoResultsText,
  kSearchLabel,
  kToggleDarkMode,
  kToggleNavigation,
  kToggleReaderMode,
  kToggleSidebar,
  kToggleSection,
  kCopyButtonTooltip,
  kCopyButtonTooltipSuccess,
  kBackToTop,
  kRepoActionLinksEdit,
  kRepoActionLinksSource,
  kRepoActionLinksIssue,
  kSearchMatchingDocumentsText,
  kSearchCopyLinkTitle,
  kSearchHideMatchesText,
  kSearchMoreMatchText,
  kSearchMoreMatchesText,
  kSearchClearButtonTitle,
  kSearchDetatchedCancelButtonTitle,
  kSearchSubmitButtonTitle,
  kCrossrefFigTitle,
  kCrossrefTblTitle,
  kCrossrefLstTitle,
  kCrossrefThmTitle,
  kCrossrefLemTitle,
  kCrossrefCorTitle,
  kCrossrefPrfTitle,
  kCrossrefCnjTitle,
  kCrossrefDefTitle,
  kCrossrefExmTitle,
  kCrossrefExrTitle,
  kCrossrefFigPrefix,
  kCrossrefTblPrefix,
  kCrossrefLstPrefix,
  kCrossrefChPrefix,
  kCrossrefApxPrefix,
  kCrossrefSecPrefix,
  kCrossrefEqPrefix,
  kCrossrefThmPrefix,
  kCrossrefLemPrefix,
  kCrossrefCorPrefix,
  kCrossrefPrpPrefix,
  kCrossrefCnjPrefix,
  kCrossrefDefPrefix,
  kCrossrefExmPrefix,
  kCrossrefExrPrefix,
  kCrossrefLofTitle,
  kCrossrefLotTitle,
  kCrossrefLolTitle,
  kEnvironmentProofTitle,
  kEnvironmentRemarkTitle,
  kEnvironmentSolutionTitle,
  kListingPageOrderBy,
  kListingPageOrderByDefault,
  kListingPageOrderByDateAsc,
  kListingPageOrderByDateDesc,
  kListingPageOrderByNumberAsc,
  kListingPageOrderByNumberDesc,
  kListingPageFieldDate,
  kListingPageFieldTitle,
  kListingPageFieldDescription,
  kListingPageFieldAuthor,
  kListingPageFieldFileName,
  kListingPageFieldFileModified,
  kListingPageFieldSubtitle,
  kListingPageFieldReadingTime,
  kListingPageFieldCategories,
  kListingPageMinutesCompact,
  kListingPageCategoryAll,
  kListingPageNoMatches,
  kTitleBlockAuthorSingle,
  kTitleBlockAuthorPlural,
  kTitleBlockAffiliationSingle,
  kTitleBlockAffiliationPlural,
  kTitleBlockPublished,
  kTitleBlockModified,
  kNotebookPreviewDownload,
  kNotebookPreviewDownloadSrc,
  kNotebookPreviewBack,
  kArticleNotebookLabel,
  kManuscriptMecaBundle,
];

// 'defaults' fields
export const kTo = "to";
export const kFrom = "from";
export const kReader = "reader";
export const kWriter = "writer";
export const kOutputFile = "output-file";
export const kInputFiles = "input-files";
export const kMarkdownHeadings = "markdown-headings";
export const kTemplate = "template";
export const kWrap = "wrap";
export const kColumns = "columns";
export const kStandalone = "standalone";
export const kSelfContained = "self-contained";
export const kEmbedResources = "embed-resources";
export const kIncludeBeforeBody = "include-before-body";
export const kIncludeAfterBody = "include-after-body";
export const kIncludeInHeader = "include-in-header";
export const kResourcePath = "resource-path";
export const kCiteproc = "citeproc";
export const kCiteMethod = "cite-method";
export const kFilters = "filters";
export const kQuartoFilters = "quarto-filters";
export const kFilterParams = "filter-params";
export const kPdfEngine = "pdf-engine";
export const kNotebooks = "notebooks";
export const kPdfEngineOpts = "pdf-engine-opts";
export const kPdfEngineOpt = "pdf-engine-opt";
export const kListings = "listings";
export const kNumberSections = "number-sections";
export const kSectionNumbering = "section-numbering";
export const kNumberOffset = "number-offset";
export const kShiftHeadingLevelBy = "shift-heading-level-by";
export const kNumberDepth = "number-depth";
export const kTopLevelDivision = "top-level-division";
export const kPaperSize = "papersize";
export const kLogFile = "log-file";
export const kHighlightStyle = "highlight-style";
export const kDefaultImageExtension = "default-image-extension";
export const kLinkColor = "linkcolor";
export const kColorLinks = "colorlinks";
export const kVariables = "variables";
export const kMetadataFile = "metadata-file";
export const kMetadataFiles = "metadata-files";
export const kSyntaxDefinitions = "syntax-definitions";
export const kSyntaxDefinition = "syntax-definition";
export const kReferenceDoc = "reference-doc";
export const kHtmlMathMethod = "html-math-method";
export const kToc = "toc";
export const kTocDepth = "toc-depth";
export const kTableOfContents = "table-of-contents";
export const kSectionDivs = "section-divs";
export const kEPubCoverImage = "epub-cover-image";
export const kReferenceLocation = "reference-location";
export const kCitationLocation = "citation-location";
export const kQuartoVarsKey = "_quarto-vars";
export const kQuartoTemplateParams = "quarto-template-params";
export const kRevealJsScripts = "reveal-jsscripts";

// command line flags
export const kMathjax = "mathjax";
export const kKatex = "katex";
export const kMathml = "mathml";
export const kGladtex = "gladtex";
export const kWebtex = "webtex";

// metadata fields
export const kQuartoInternal = "quarto-internal";
export const kTitle = "title";
export const kSubtitle = "subtitle";
export const kAuthor = "author";
export const kDate = "date";
export const kDateFormat = "date-format";
export const kDateModified = "date-modified";
export const kDoi = "doi";
export const kAbstract = "abstract";
export const kAbstractTitle = "abstract-title";
export const kDescription = "description";
export const kHideDescription = "hide-description";
export const kTocTitle = "toc-title";
export const kTocLocation = "toc-location";
export const kTocExpand = "toc-expand";
export const kLang = "lang";
export const kOrder = "order";

// The authors user input
export const KAuthor = "author";
export const kAuthors = "authors";
export const kDateFormatted = "date-formatted";

// Institute processing
export const kInstitute = "institute";
export const kInstitutes = "institutes";

export const kServer = "server";

export const kPageTitle = "pagetitle";
export const kTitlePrefix = "title-prefix";
export const kCsl = "csl";
export const kNoCite = "nocite";
export const kCss = "css";
export const kBibliography = "bibliography";
export const kReferences = "references";
export const kHeaderIncludes = "header-includes";
export const kIncludeBefore = "include-before";
export const kIncludeAfter = "include-after";
export const kLinkCitations = "link-citations";
export const kDocumentClass = "documentclass";
export const kClassOption = "classoption";
export const kSlideLevel = "slide-level";

export const kTheme = "theme";
export const kCrossref = "crossref";
export const kCrossrefChapters = "chapters";
export const kCrossrefLabels = "labels";
export const kCrossrefAppendixTitle = "appendix-title";
export const kCrossrefAppendixDelim = "appendix-delim";
export const kCrossrefChaptersAppendix = "chapters-appendix";
export const kCrossrefChaptersAlpha = "chapters-alpha";
export const kCrossrefChapterId = "chapter-id";

export const kGrid = "grid";
export const kContentMode = "content-mode";
export const kAuto = "auto";
export const kStandardContent = "standard";
export const kFullContent = "full";
export const kSlimContent = "slim";

export const kFigResponsive = "fig-responsive";
export const kOutputLocation = "output-location";

export const kCapLoc = "cap-location";
export const kFigCapLoc = "fig-cap-location";
export const kTblCapLoc = "tbl-cap-location";

export const kCapTop = "top";
export const kCapBottom = "bottom";

// Pandoc Input Traits
export const kPositionedRefs = "positioned-refs";

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
  "defaults",
  kTemplate,
  kStandalone,
  kSelfContained,
  kEmbedResources,
  kVariables,
  "metadata",
  kMetadataFiles,
  kMetadataFile,
  kIncludeBeforeBody,
  kIncludeAfterBody,
  kIncludeInHeader,
  kResourcePath,
  kCiteproc,
  kCiteMethod,
  "citation-abbreviations",
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
  kWrap,
  kColumns,
  "dpi",
  "extract-media",
  kToc,
  kTableOfContents,
  kTocDepth,
  kNumberSections,
  kNumberOffset,
  kShiftHeadingLevelBy,
  kSectionDivs,
  "identifier-prefix",
  kTitlePrefix,
  "eol",
  "strip-comments",
  "indented-code-classes",
  "ascii",
  kDefaultImageExtension,
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
  kSlideLevel,
  "epub-subdirectory",
  "epub-metadata",
  "epub-fonts",
  "epub-chapter-level",
  kEPubCoverImage,
  "reference-links",
  kReferenceLocation,
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

// cell options + metadata
export const kCellCollapsed = "collapsed";
export const kCellAutoscroll = "autoscroll";
export const kCellDeletable = "deletable";
export const kCellFormat = "format";
export const kCellName = "name";
export const kCellTags = "tags";
export const kCellLinesToNext = "lines_to_next_cell";
export const kCellLanguage = "language";
export const kCellSlideshow = "slideshow";
export const kCellSlideshowSlideType = "slide_type";
export const kCellRawMimeType = "raw_mimetype";
export const kCellUserExpressions = "user_expressions";

export const kCellId = "id";
export const kCellLabel = "label";
export const kCellFigCap = "fig-cap";
export const kCellFigSubCap = "fig-subcap";
export const kCellFigScap = "fig-scap";
export const kCellFigColumn = "fig-column";
export const kCellTblColumn = "tbl-column";
export const kCellFigLink = "fig-link";
export const kCellFigAlign = "fig-align";
export const kCellFigEnv = "fig-env";
export const kCellFigPos = "fig-pos";
export const kCellFigAlt = "fig-alt";
export const kCellLstLabel = "lst-label";
export const kCellLstCap = "lst-cap";
export const kCellClasses = "classes";
export const kCellPanel = "panel";
export const kCellColumn = "column";
export const kCellOutWidth = "out-width";
export const kCellOutHeight = "out-height";
export const kCellMdIndent = "md-indent";

export const kCellColab = "colab";
export const kCellColabType = "colab_type";
export const kCellColbOutputId = "outputId";

export const kLayoutAlign = "layout-align";
export const kLayoutVAlign = "layout-valign";
export const kLayoutNcol = "layout-ncol";
export const kLayoutNrow = "layout-nrow";
export const kLayout = "layout";

// https://github.com/quarto-dev/quarto-cli/issues/3581
export const kCliffyImplicitCwd = "5a6d2e4f-f9a2-43bc-8019-8149fbb76c85";
